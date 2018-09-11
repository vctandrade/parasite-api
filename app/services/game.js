const config = require('config')
const uuid = require('uuid/v4')

const Queue = require('bee-queue')

module.exports = function init () {
  const createRoom = new Queue('create-room', {
    redis: config.get('Redis')
  })

  createRoom.process(async job => {
    return uuid()
  })
}
