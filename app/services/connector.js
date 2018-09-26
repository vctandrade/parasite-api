const error = require('../shared/error')

const { OAuth2Client } = require('google-auth-library')
const { version } = require('../package.json')

module.exports = class Connector {
  constructor (discovery, redisClient) {
    this.discovery = discovery
    this.redis = redisClient

    this.auth = new OAuth2Client()
    this.sessions = new Map()

    discovery.on('game', body => {
      const { topic, data } = body

      const session = this.sessions.get(data.playerID)
      session.push(topic, data.content)

      if (topic === 'close') {
        this.leaveRoom(session)
      }
    })
  }

  async info () {
    return { version }
  }

  async login (session, args) {
    const { token } = args

    if (session.state.playerID !== undefined) throw error.MULTIPLE_LOGINS

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

    session.state.playerID = playerID
  }

  async logout (session) {
    await this.leaveRoom(session)
    await this.redis.srem('players', session.state.playerID)
    session.state.playerID = undefined
  }

  async createRoom (session, args) {
    if (session.state.playerID === undefined) throw error.UNAUTHORIZED

    const channel = this.discovery.getAny('game')
    const response = await channel.request('createRoom', args)

    await this.redis.hset('room', response.roomID, channel.hostname)

    return { roomID: response.roomID }
  }

  async joinRoom (session, args) {
    const { nickname, roomID } = args

    if (session.state.playerID === undefined) throw error.UNAUTHORIZED
    if (session.state.roomID !== undefined) throw error.MULTIPLE_JOINS

    const hostname = await this.redis.hget('room', roomID)
    const channel = this.discovery.get(hostname)

    if (hostname === null) throw error.BAD_REQUEST

    const room = await channel.request('joinRoom', { playerID: session.state.playerID, nickname, roomID })

    channel.ws.once('close', () => {
      this.leaveRoom(session)
      session.push('kick')
    })

    session.state.roomID = roomID
    session.state.hostname = hostname

    return { room }
  }

  async leaveRoom (session) {
    if (session.state.playerID === undefined) throw error.UNAUTHORIZED

    const channel = this.discovery.get(session.state.hostname)

    if (channel !== undefined) {
      channel.send('leaveRoom', { playerID: session.state.playerID, roomID: session.state.roomID })
    }

    session.state.roomID = undefined
    session.state.hostname = undefined
  }
}
