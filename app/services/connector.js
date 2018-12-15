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

    discovery.on('push', body => {
      const { topic, data } = body

      const session = this.sessions.get(data.playerID)

      if (session === undefined) {
        return
      }

      if (topic !== 'internal') session.push(topic, data.content)
      else {
        const method = this[data.content.route]
        method.call(this, session, data.content.args)
      }
    })

    function deeplink (ctx, id) {
      ctx.redirect('parasite-app://invite?id=' + id)
    }

    koa.use(route.get('/game/:id', deeplink))
  }

  async ping () {
    return {
      timestamp: Date.now()
    }
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

    if (session.player !== undefined) throw error.MULTIPLE_LOGINS

    const player = await this.database.Player.findOne({ where: { token } })

    if (player === null) throw error.UNAUTHORIZED
    if (await this.redis.sadd('players', player.id) === 0) throw error.MULTIPLE_LOGINS

    session.player = player
    session.disconnector = () => {
      this.logout(session)
    }

    session.ws.on('close', session.disconnector)
    this.sessions.set(player.id, session)

    return {
      id: session.player.id,
      name: session.player.name
    }
  }

  async logout (session) {
    await this.leaveGame(session)
    await this.redis.srem('players', session.player.id)

    this.sessions.delete(session.player.id)
    session.ws.off('close', session.disconnector)

    session.player = undefined
    session.disconnector = undefined
  }

  async updateAccount (session, args) {
    if (session.player === undefined) throw error.UNAUTHORIZED

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
    if (session.player === undefined) throw error.UNAUTHORIZED

    const channel = this.discovery.getAny('game')
    const response = await channel.request('createGame', args)

    await this.redis.hset('game', response.gameID, channel.hostname)

    return { gameID: response.gameID }
  }

  async joinGame (session, args) {
    const { gameID } = args

    if (session.player === undefined) throw error.UNAUTHORIZED
    if (session.gameID !== undefined) throw error.MULTIPLE_JOINS

    const hostname = await this.redis.hget('game', gameID)
    const channel = this.discovery.get(hostname)

    if (hostname === null) throw error.BAD_REQUEST

    const game = await channel.request('joinGame', { playerID: session.player.id, playerName: session.player.name, gameID })

    session.gameID = gameID
    session.hostname = hostname
    session.kicker = () => {
      this.leaveGame(session)
      session.push('kick')
    }

    channel.on('close', session.kicker)

    return game
  }

  async leaveGame (session) {
    if (session.player === undefined) throw error.UNAUTHORIZED

    const channel = this.discovery.get(session.hostname)

    if (channel) {
      channel.send('leaveGame', { playerID: session.player.id, gameID: session.gameID })
      channel.off('close', session.kicker)
    }

    session.gameID = undefined
    session.hostname = undefined
    session.kicker = undefined
  }

  async execute (session, args) {
    const { action, target } = args

    if (session.player === undefined) throw error.UNAUTHORIZED
    if (session.gameID === undefined) throw error.NOT_IN_GAME

    const channel = this.discovery.get(session.hostname)

    return channel.request('execute', { playerID: session.player.id, gameID: session.gameID, action, target })
  }
}
