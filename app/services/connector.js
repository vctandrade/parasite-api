const config = require('config')
const errors = require('../shared/errors')
const redis = require('async-redis')

module.exports = class Connector {
  constructor (proxy) {
    this.proxy = proxy
    this.sessions = new Map()
    this.redis = redis.createClient(config.get('Redis'))

    proxy.on('game', data => {
      const { userID, content } = data
      const session = this.sessions.get(userID)

      if (session) session.push(content)
    })
  }

  async login (session, args) {
    const { userID } = args

    if (session.state.userID !== undefined) return { error: errors.ALREADY_LOGGED }

    this.sessions.set(userID, session)
    session.ws.on('close', () => this.sessions.delete(userID))

    session.state = {
      userID,
      roomID: null,
      nodeID: null
    }

    return { error: null }
  }

  async createRoom (session) {
    if (session.state.userID === undefined) return { error: errors.NOT_LOGGED }
    if (session.state.roomID !== null) return { error: errors.ALREADY_IN_ROOM }

    const channel = this.proxy.getAny('game')
    const roomID = await channel.request('createRoom')

    this.redis.hset('room', roomID, channel.node.id)

    return { error: null, roomID }
  }

  async joinRoom (session, args) {
    const { roomID } = args

    if (session.state.userID === undefined) return { error: errors.NOT_LOGGED }
    if (session.state.roomID !== null) return { error: errors.ALREADY_IN_ROOM }

    const nodeID = await this.redis.hget('room', roomID)
    const channel = this.proxy.get(nodeID)

    if (channel === undefined) return { error: errors.ROOM_INEXISTENT }

    const error = await channel.request('joinRoom', { userID: session.state.userID, roomID })

    if (error !== null) return { error }

    session.state.roomID = roomID
    session.state.nodeID = nodeID

    return { error: null }
  }

  async leaveRoom (session) {
    if (session.state.userID === undefined) return { error: errors.NOT_LOGGED }
    if (session.state.roomID === null) return { error: errors.NOT_IN_ROOM }

    const channel = this.proxy.get(session.state.nodeID)

    if (channel !== undefined) {
      channel.send('leaveRoom', { userID: session.state.userID, roomID: session.state.roomID })
    }

    session.state.roomID = null
    session.state.nodeID = null

    return { error: null }
  }
}
