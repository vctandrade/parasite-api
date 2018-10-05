const _ = require('lodash')

const error = require('../shared/error')
const jobs = require('../shared/jobs')
const shortid = require('shortid')

const EventEmitter = require('events')

class Player {
  constructor (id, nickname, session) {
    this.id = id
    this.nickname = nickname
    this.session = session
  }

  push (topic, data) {
    this.session.push(topic, { playerID: this.id, content: data })
  }

  toJSON () {
    return this.nickname
  }
}

class Room extends EventEmitter {
  constructor (roster) {
    super()

    this.roster = _.map(roster, jobID => {
      const Job = jobs[jobID]
      if (Job === undefined) throw error.BAD_REQUEST
      return new Job()
    })

    this.players = []
    this.timer = null

    this.state = 'waiting' // TODO: actual state behaviours
  }

  add (playerID, nickname, session) {
    if (this.state !== 'waiting') throw error.ROOM_FULL
    if (this.timer !== null) throw error.ROOM_FULL

    const player = new Player(playerID, nickname, session)

    this.players.push(player)
    this.push('state', this)

    if (this.players.length === this.roster.length) {
      this.timer = setTimeout(() => this.begin(), 10000)
    }
  }

  begin () {
    _.zipWith(this.players, _.shuffle(this.roster), (player, job) => {
      player.push('start', { job })
    })

    this.state = 'started'
    setTimeout(() => this.close(), 10000)
  }

  remove (playerID) {
    _.remove(this.players, player => player.id === playerID)
    this.push('state', this)

    clearTimeout(this.timer)
    this.timer = null
  }

  push (topic, data) {
    this.players.forEach(player => {
      player.push(topic, data)
    })
  }

  close () {
    this.push('kick')
    this.emit('close')
  }

  toJSON () {
    return { players: this.players }
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
    room.on('close', () => {
      this.redis.hdel('room', roomID)
      this.rooms.delete(roomID)
    })

    return { roomID }
  }

  async joinRoom (session, args) {
    const { playerID, nickname, roomID } = args

    const room = this.rooms.get(roomID)

    room.add(playerID, nickname, session)
    session.ws.on('close', () => this.leaveRoom(playerID))

    return { roster: room.roster }
  }

  async leaveRoom (session, args) {
    const { playerID, roomID } = args

    const room = this.rooms.get(roomID)
    if (room !== undefined) room.remove(playerID)
  }
}
