const _ = require('lodash')

const error = require('../shared/error')
const route = require('koa-route')
const uuid = require('uuid/v4')

const { OAuth2Client } = require('google-auth-library')
const { version } = require('../package.json')

module.exports = class {
  constructor (modules) {
    const { discovery, database, redis, koa } = modules

    this.discovery = discovery
    this.database = database
    this.redis = redis

    this.auth = new OAuth2Client()
    this.sessions = new Map()

    discovery.on('game', body => {
      const { topic, data } = body

      const session = this.sessions.get(data.playerID)
      if (session === undefined) return

      session.push(topic, data.content)

      if (topic === 'kick') {
        this.leaveGame(session)
      }
    })

    function deeplink (ctx, id) {
      ctx.redirect('parasite-app://invite?id=' + id)
    }

    koa.use(route.get('/game/:id', deeplink))
  }

  async info () {
    return { version }
  }

  async oauth (session, args) {
    const { token } = args

    const ticket = await this.auth.verifyIdToken({ idToken: token, audience: process.env.CLIENT_ID })
      .catch(reason => {
        throw error.UNAUTHORIZED
      })

    const payload = ticket.getPayload()
    const player = await this.database.Player
      .findOrCreate({
        where: {
          id: payload.sub
        },
        defaults: {
          name: payload.given_name
        }
      })
      .spread((player, created) => player)

    player.token = uuid()
    await player.save()

    return {
      token: player.token
    }
  }

  async login (session, args) {
    const { token } = args

    if (session.player !== null) throw error.MULTIPLE_LOGINS

    const player = await this.database.Player.findOne({ where: { token } })

    if (player === null) throw error.UNAUTHORIZED
    if (await this.redis.sadd('players', player.id) === 0) throw error.MULTIPLE_LOGINS

    session.player = player
    this.sessions.set(player.id, session)

    session.ws.on('close', () => {
      this.logout(session)
      this.sessions.delete(player.id)
    })

    return {
      id: session.player.id,
      name: session.player.name
    }
  }

  async logout (session) {
    await this.leaveGame(session)
    await this.redis.srem('players', session.player.id)
    session.player = null
  }

  async updateAccount (session, args) {
    if (session.player === null) throw error.UNAUTHORIZED

    args = _.omit(args, 'id')

    await session.player.update(args)
      .catch(async reason => {
        await session.player.reload()
        throw error.BAD_REQUEST
      })

    return {
      name: session.player.name
    }
  }

  async createGame (session, args) {
    if (session.player === null) throw error.UNAUTHORIZED

    const channel = this.discovery.getAny('game')
    const response = await channel.request('createGame', args)

    await this.redis.hset('game', response.gameID, channel.hostname)

    return { gameID: response.gameID }
  }

  async joinGame (session, args) {
    const { gameID } = args

    if (session.player === null) throw error.UNAUTHORIZED
    if (session.gameID !== null) throw error.MULTIPLE_JOINS

    const hostname = await this.redis.hget('game', gameID)
    const channel = this.discovery.get(hostname)

    if (hostname === null) throw error.BAD_REQUEST

    const game = await channel.request('joinGame', { playerID: session.player.id, playerName: session.player.name, gameID })

    channel.ws.once('close', session.disconnector)

    session.gameID = gameID
    session.hostname = hostname

    return game
  }

  async leaveGame (session) {
    if (session.player === null) throw error.UNAUTHORIZED

    const channel = this.discovery.get(session.hostname)

    if (channel) {
      channel.send('leaveGame', { playerID: session.player.id, gameID: session.gameID })
      channel.ws.off('close', session.disconnector)
    }

    session.gameID = null
    session.hostname = null
  }

  async execute (session, args) {
    const { action, target } = args

    if (session.player === null) throw error.UNAUTHORIZED
    if (session.gameID === null) throw error.NOT_IN_GAME

    const channel = this.discovery.get(session.hostname)

    return channel.request('execute', { playerID: session.player.id, gameID: session.gameID, action, target })
  }
}
