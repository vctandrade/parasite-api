const _ = require('lodash')

const jobs = require('../shared/jobs')
const error = require('../shared/error')
const shortid = require('shortid')

class Room {
  constructor (roster) {
    this.users = new Map()
    this.roster = _.map(roster, id => {
      const Job = jobs[id]
      if (Job === undefined) throw error.BAD_REQUEST
      return new Job()
    })
  }

  add (userID, session) {
    if (this.users.size === this.roster.length) throw error.ROOM_FULL

    this.users.set(userID, session)
    this.pushState()
  }

  remove (userID) {
    this.users.delete(userID)
    this.pushState()
  }

  pushState () {
    const state = [...this.users.keys()]
    this.users.forEach((session, userID) => {
      session.push('state', { userID, content: state })
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
    const room = new Room(roster)

    this.rooms.set(roomID, room)

    return { roomID }
  }

  async joinRoom (session, args) {
    const { userID, roomID } = args

    const room = this.rooms.get(roomID)
    room.add(userID, session)

    return { roster: room.roster }
  }

  async leaveRoom (session, args) {
    const { userID, roomID } = args

    const room = this.rooms.get(roomID)
    if (room !== undefined) room.remove(userID)
  }
}
