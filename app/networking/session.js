const EventEmitter = require('events')

module.exports = class Session extends EventEmitter {
  constructor (ws) {
    super()

    this.ws = ws
    this.info = {}
  }
}
