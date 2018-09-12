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
  }

  async login (session, args) {
    const { user } = args

    if (session.state.user !== undefined) return { error: err.ALREADY_LOGGED }

    session.state.user = user
    this.sessions.set(user, session)

    session.ws.on('close', () => this.sessions.delete(user))

    const room = await this.redis.hget('user', user)
    const node = await this.redis.hget('room', room)

    if (node === null) {
      this.redis.hdel('user', user)

      session.state.room = null
      session.state.channel = null

      return { error: null, room: null }
    }

    session.state.room = room
    session.state.channel = this.proxy.get(node)

    return { error: null, room }
  }

  async createRoom (session) {
    if (session.state.user === undefined) return { error: err.NOT_LOGGED }
    if (session.state.room !== null) return { error: err.ALREADY_IN_ROOM }

    const channel = this.proxy.getAny('game')
    const room = await channel.request('createRoom')

    this.redis.hset('room', room, channel.node.id)
    this.redis.hset('user', session.state.user, room)

    session.state.room = room
    session.state.channel = channel

    return { error: null, room }
  }

  async joinRoom (session, args) {
    const { room } = args

    if (session.state.user === undefined) return { error: err.NOT_LOGGED }
    if (session.state.room !== null) return { error: err.ALREADY_IN_ROOM }

    const node = await this.redis.hget('room', room)
    const channel = this.proxy.get(node)

    this.redis.hset('user', session.state.user, room)

    session.state.room = room
    session.state.channel = channel

    return { error: null }
  }

  async leaveRoom (session) {
    if (session.state.user === undefined) return { error: err.NOT_LOGGED }
    if (session.state.room === null) return { error: err.NOT_IN_ROOM }

    this.redis.hdel('user', session.state.user)

    session.state.room = null
    session.state.channel = null

    return { error: null }
  }
}
