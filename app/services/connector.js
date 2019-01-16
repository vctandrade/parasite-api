const _ = require('lodash')

const error = require('../shared/error')
const packs = require('../shared/packs')
const route = require('koa-route')
const uuid = require('uuid/v4')

const { OAuth2Client } = require('google-auth-library')
const { version } = require('../package.json')

module.exports = class {
  constructor (modules) {
    const { discovery, database, redis, redlock, koa } = modules

    this.discovery = discovery
    this.database = database
    this.redis = redis
    this.redlock = redlock

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
          name: payload.given_name,
          packs: ['basic']
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

    const player = await this.database.Player.findOne({ where: { token } })

    if (player === null) throw error.UNAUTHORIZED

    if (session.player !== undefined) {
      await this.logout(session)
    }

    const lock = await this.redlock.lock('locks:player:' + player.id, 1000)
    const hostname = await this.redis.hget('players', player.id)

    if (hostname === this.discovery.hostname) await this.disconnect(null, { playerID: player.id })
    else {
      const channel = this.discovery.get(hostname)

      if (channel) {
        await channel.request('disconnect', { playerID: player.id })
      }
    }

    await this.redis.hset('players', player.id, this.discovery.hostname)
    await lock.unlock()

    session.player = player
    session.disconnector = () => {
      this.logout(session)
    }

    session.ws.on('close', session.disconnector)
    this.sessions.set(player.id, session)

    return {
      name: player.name,
      packs: player.packs
    }
  }

  async logout (session) {
    session.ws.off('close', session.disconnector)
    this.sessions.delete(session.player.id)

    await this.redis.hdel('players', session.player.id)
    await this.leaveGame(session)

    session.player = undefined
    session.disconnector = undefined
  }

  async disconnect (session, args) {
    const { playerID } = args

    if (session === null || session.ws.source === 'internal');
    else throw error.UNAUTHORIZED

    const target = this.sessions.get(playerID)

    if (target) {
      await target.push('disconnect')
      await this.logout(target)
    }
  }

  async updateAccount (session, args) {
    if (session.player === undefined) throw error.UNAUTHORIZED

    args = _.pick(args, 'name')

    await session.player.update(args)
      .catch(async reason => {
        await session.player.reload()
        throw error.BAD_REQUEST
      })

    return {
      name: session.player.name,
      packs: session.player.packs
    }
  }

  async buy (session, args) {
    const { pack } = args

    if (session.player === undefined) throw error.UNAUTHORIZED
    if (_(packs).omit(session.player.packs).has(pack) === false) throw error.BAD_REQUEST

    session.player.packs = _.concat(session.player.packs, pack)
    await session.player.save()

    return {
      name: session.player.name,
      packs: session.player.packs
    }
  }

  async createGame (session, args) {
    if (session.player === undefined) throw error.UNAUTHORIZED

    const roster = _
      .chain(packs)
      .pick(session.player.packs)
      .cloneDeep()
      .reduce((accumulator, value) => {
        const customizer = _.ary(_.union, 2)
        return _.assignWith(accumulator, value, customizer)
      })
      .value()

    const valid = _(args)
      .map((group, key) => _(group).map(value => _.includes(roster[key], value)).every())
      .every()

    if (valid === false) throw error.BAD_REQUEST

    const channel = this.discovery.getAny('game')
    const response = await channel.request('createGame', args)

    await this.redis.hset('game', response.gameID, channel.hostname)

    return { gameID: response.gameID }
  }

  async joinGame (session, args) {
    const { gameID } = args

    if (session.player === undefined) throw error.UNAUTHORIZED
    if (session.gameID !== undefined) {
      await this.leaveGame(session)
    }

    const hostname = await this.redis.hget('game', gameID)

    if (hostname === null) throw error.BAD_REQUEST

    const channel = this.discovery.get(hostname)
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
      await channel.request('leaveGame', { playerID: session.player.id, gameID: session.gameID })
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
