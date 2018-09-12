const config = require('config')
const redis = require('async-redis')

const err = {
  ALREADY_IN_ROOM: 'User already in room',
  ALREADY_LOGGED: 'User already logged in',
  NOT_IN_ROOM: 'User not it any room',
  NOT_LOGGED: 'User not logged in'
}

module.exports = class Connector {
  constructor (proxy) {
    this.proxy = proxy
    this.sessions = new Map()
    this.redis = redis.createClient(config.get('Redis'))

    proxy.on('game', data => {
      const { user, message } = data
      const session = this.sessions.get(user)

      if (session) session.push(message)
    })
  }

  async login (session, args) {
    const { user } = args

    if (session.state.user !== undefined) return { error: err.ALREADY_LOGGED }

    this.sessions.set(user, session)
    session.ws.on('close', () => this.sessions.delete(user))

    session.state = {
      user,
      room: null,
      node: null
    }

    return { error: null }
  }

  async createRoom (session) {
    if (session.state.user === undefined) return { error: err.NOT_LOGGED }
    if (session.state.room !== null) return { error: err.ALREADY_IN_ROOM }

    const channel = this.proxy.getAny('game')
    const room = await channel.request('createRoom')

    this.redis.hset('room', room, channel.node.id)

    return { error: null, room }
  }

  async joinRoom (session, args) {
    const { room } = args

    if (session.state.user === undefined) return { error: err.NOT_LOGGED }
    if (session.state.room !== null) return { error: err.ALREADY_IN_ROOM }

    const node = await this.redis.hget('room', room)

    session.state.room = room
    session.state.node = node

    return { error: null }
  }

  async leaveRoom (session) {
    if (session.state.user === undefined) return { error: err.NOT_LOGGED }
    if (session.state.room === null) return { error: err.NOT_IN_ROOM }

    session.state.room = null
    session.state.node = null

    return { error: null }
  }
}
