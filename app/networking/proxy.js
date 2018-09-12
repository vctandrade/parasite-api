const _ = require('lodash')

const Channel = require('./channel')
const EventEmitter = require('events')

module.exports = class Proxy extends EventEmitter {
  constructor () {
    super()

    this.channels = new Map()
  }

  add (node) {
    const c = new Channel(node)
    this.channels.set(node.id, c)

    c.on('push', data => this.emit(node.advertisement, data))
  }

  remove (node) {
    const c = this.channels.get(node.id)

    if (c !== undefined) {
      c.close()
      this.channels.delete(node.id)
    }
  }

  get (id) {
    return this.channels.get(id)
  }

  getAny (service) {
    var pool

    pool = [...this.channels.values()]
    pool = _.filter(pool, c => c.node.advertisement === service)

    return _.sample(pool)
  }

  close () {
    this.channels.forEach(c => c.close())
  }
}
