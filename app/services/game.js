const _ = require('lodash')

const error = require('../shared/error')
const jobs = require('../shared/jobs')
const shortid = require('shortid')

const EventEmitter = require('events')

class Player {
  constructor (id, nickname) {
    this.id = id
    this.nickname = nickname

    this.session = null
    this.job = null
  }

  isConnected () {
    return this.session !== null
  }

  push (topic, data) {
    if (this.isConnected()) this.session.push(topic, { playerID: this.id, content: data })
  }

  toJSON () {
    return this.nickname
  }
}

class Lobby {
  constructor (room, roster) {
    this.room = room
    this.roster = roster

    this.startTime = null
    this.timer = null
  }

  isFull () {
    return this.room.players.length === this.roster.length
  }

  join (player, session) {
    if (this.isFull()) throw error.ROOM_FULL

    this.room.players.push(player)

    if (this.isFull()) {
      this.timer = setTimeout(() => this.begin(), 15000)
      this.startTime = Date.now() + 15000
    }

    this.room.push('state', this)
    player.session = session

    return { roster: this.roster, state: this }
  }

  leave (playerID) {
    _.remove(this.room.players, player => player.id === playerID)

    clearTimeout(this.timer)
    this.timer = null
    this.startTime = null

    this.room.push('state', this)
  }

  begin () {
    _.zipWith(this.room.players, _.shuffle(this.roster), (player, job) => {
      player.job = job
      player.push('start', { job })
    })

    setTimeout(() => this.room.close(), 10000)
  }

  toJSON () {
    return {
      players: this.room.players,
      startTime: this.startTime
    }
  }
}

class Room extends EventEmitter {
  constructor (roster) {
    super()

    roster = _.map(roster, jobID => {
      const Job = jobs[jobID]
      if (Job === undefined) throw error.BAD_REQUEST
      return new Job()
    })

    this.state = new Lobby(this, roster)
    this.players = []
  }

  join (player, session) {
    return this.state.join(player, session)
  }

  leave (playerID) {
    return this.state.leave(playerID)
  }

  close () {
    this.push('kick')
    this.emit('close')
  }

  push (topic, data) {
    this.players.forEach(player => player.push(topic, data))
  }
}

module.exports = class Game {
  constructor (discovery, redis, koa) {
    this.redis = redis
    this.rooms = new Map()
  }

  async createRoom (session, args) {
    const { roster } = args

    if (roster.length < 2) throw error.BAD_REQUEST

    const roomID = shortid.generate()
    const room = new Room(roster)

    this.rooms.set(roomID, room)

    room.once('close', () => {
      this.redis.hdel('room', roomID)
      this.rooms.delete(roomID)
    })

    return { roomID }
  }

  async joinRoom (session, args) {
    const { playerID, nickname, roomID } = args

    const player = new Player(playerID, nickname)
    const room = this.rooms.get(roomID)

    if (room === undefined) throw error.BAD_REQUEST

    session.ws.once('close', () => this.leaveRoom(playerID))

    return room.join(player, session)
  }

  async leaveRoom (session, args) {
    const { playerID, roomID } = args

    const room = this.rooms.get(roomID)
    if (room === undefined) return

    return room.leave(playerID)
  }
}
