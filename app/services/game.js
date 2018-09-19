const _ = require('lodash')

const jobs = require('../shared/jobs')
const error = require('../shared/error')
const shortid = require('shortid')

class Room {
  constructor (id, roster) {
    this.id = id
    this.roster = _.map(roster, jobID => {
      const Job = jobs[jobID]
      if (Job === undefined) throw error.BAD_REQUEST
      return new Job()
    })

    this.sessions = new Map()
  }

  add (playerID, session) {
    if (this.sessions.size === this.roster.length) throw error.ROOM_FULL

    this.sessions.set(playerID, session)
    this.pushState()
  }

  remove (playerID) {
    this.sessions.delete(playerID)
    this.pushState()
  }

  pushState () {
    const content = {
      roomID: this.id,
      players: [...this.sessions.keys()]
    }

    this.sessions.forEach((session, playerID) => {
      session.push('state', { playerID, content })
    })
  }
}

module.exports = class Game {
  constructor () {
    this.rooms = new Map()
  }

  async createRoom (session, args) {
    const { roster } = args

    const roomID = shortid.generate()
    const room = new Room(roomID, roster)

    this.rooms.set(roomID, room)

    return { roomID }
  }

  async joinRoom (session, args) {
    const { playerID, roomID } = args

    const room = this.rooms.get(roomID)
    room.add(playerID, session)

    return { roster: room.roster }
  }

  async leaveRoom (session, args) {
    const { playerID, roomID } = args

    const room = this.rooms.get(roomID)
    if (room !== undefined) room.remove(playerID)
  }
}
