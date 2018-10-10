const error = require('../shared/error')
const route = require('koa-route')

const { OAuth2Client } = require('google-auth-library')
const { version } = require('../package.json')

module.exports = class {
  constructor (discovery, redis, koa) {
    this.discovery = discovery
    this.redis = redis

    this.auth = new OAuth2Client()
    this.sessions = new Map()

    discovery.on('game', body => {
      const { topic, data } = body

      const session = this.sessions.get(data.playerID)
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

  async login (session, args) {
    const { token } = args

    if (session.playerID !== null) throw error.MULTIPLE_LOGINS

    const ticket = await this.auth.verifyIdToken({ idToken: token, audience: process.env.CLIENT_ID })
      .catch(reason => {
        throw error.UNAUTHORIZED
      })

    const playerID = ticket.getPayload().sub

    if (await this.redis.sismember('players', playerID)) throw error.MULTIPLE_LOGINS
    await this.redis.sadd('players', playerID)

    this.sessions.set(playerID, session)
    session.ws.on('close', () => {
      this.logout(session)
      this.sessions.delete(playerID)
    })

    session.playerID = playerID
  }

  async logout (session) {
    await this.leaveGame(session)
    await this.redis.srem('players', session.playerID)
    session.playerID = null
  }

  async createGame (session, args) {
    if (session.playerID === null) throw error.UNAUTHORIZED

    const channel = this.discovery.getAny('game')
    const response = await channel.request('createGame', args)

    await this.redis.hset('game', response.gameID, channel.hostname)

    return { gameID: response.gameID }
  }

  async joinGame (session, args) {
    const { nickname, gameID } = args

    if (session.playerID === null) throw error.UNAUTHORIZED
    if (session.gameID !== null) throw error.MULTIPLE_JOINS

    const hostname = await this.redis.hget('game', gameID)
    const channel = this.discovery.get(hostname)

    if (hostname === null) throw error.BAD_REQUEST

    const game = await channel.request('joinGame', { playerID: session.playerID, nickname, gameID })

    channel.ws.once('close', session.disconnector)

    session.gameID = gameID
    session.hostname = hostname

    return game
  }

  async leaveGame (session) {
    if (session.playerID === null) throw error.UNAUTHORIZED

    const channel = this.discovery.get(session.hostname)

    if (channel) {
      channel.send('leaveGame', { playerID: session.playerID, gameID: session.gameID })
      channel.ws.off('close', session.disconnector)
    }

    session.gameID = null
    session.hostname = null
  }

  async execute (session, args) {
    const { action, params } = args

    if (session.playerID === null) throw error.UNAUTHORIZED
    if (session.gameID === null) throw error.NOT_IN_GAME

    const channel = this.discovery.get(session.hostname)

    return channel.request('execute', { playerID: session.playerID, gameID: session.gameID, action, params })
  }
}
