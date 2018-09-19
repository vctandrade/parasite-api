const error = require('../shared/error')

const { version } = require('../package.json')

module.exports = class Connector {
  constructor (discovery, redisClient) {
    this.discovery = discovery
    this.redis = redisClient

    this.sessions = new Map()

    discovery.on('game', body => {
      const { topic, data } = body
      const session = this.sessions.get(data.playerID)

      if (session) session.push(topic, data.content)
    })
  }

  async info () {
    return { version }
  }

  async login (session, args) {
    const { playerID } = args

    this.sessions.set(playerID, session)
    session.ws.on('close', () => this.sessions.delete(playerID))

    session.state = {
      playerID,
      roomID: null,
      hostname: null
    }
  }

  async createRoom (session, args) {
    if (session.state.playerID === undefined) throw error.UNAUTHORIZED

    const channel = this.discovery.getAny('game')
    const response = await channel.request('createRoom', args)

    await this.redis.hset('room', response.roomID, channel.hostname)

    return { roomID: response.roomID }
  }

  async joinRoom (session, args) {
    const { roomID } = args

    if (session.state.playerID === undefined) throw error.UNAUTHORIZED

    const hostname = await this.redis.hget('room', roomID)
    const channel = this.discovery.get(hostname)

    if (hostname === null) throw error.BAD_REQUEST

    const room = await channel.request('joinRoom', { playerID: session.state.playerID, roomID })

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

    session.state.roomID = null
    session.state.hostname = null
  }
}
