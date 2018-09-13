const config = require('config')
const errors = require('../shared/errors')
const redis = require('async-redis')
const shortid = require('shortid')

class Room {
  constructor () {
    this.users = new Map()
  }

  add (userID, session) {
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
      session.push({ userID, content: { state } })
    })
  }
}

module.exports = class Game {
  constructor () {
    this.rooms = new Map()
    this.redis = redis.createClient(config.get('Redis'))
  }

  async createRoom (session) {
    const roomID = shortid.generate()
    const room = new Room()

    this.rooms.set(roomID, room)
    return roomID
  }

  async joinRoom (session, args) {
    const { userID, roomID } = args

    const room = this.rooms.get(roomID)
    if (room === undefined) return errors.ROOM_INEXISTENT

    room.add(userID, session)
    return null
  }

  async leaveRoom (session, args) {
    const { userID, roomID } = args

    const room = this.rooms.get(roomID)
    if (room !== undefined) room.remove(userID)
  }
}
