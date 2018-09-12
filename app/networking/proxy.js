const _ = require('lodash')

const Channel = require('./channel')

module.exports = class Proxy {
  constructor () {
    this.channels = new Map()
  }

  add (node) {
    const c = new Channel(node)
    this.channels.set(node.id, c)
  }

  remove (node) {
    const c = this.channels.get(node.id)

    if (c !== undefined) {
      c.close()
      this.channels.delete(node.id)
    }
  }

  get (service) {
    var pool

    pool = [...this.channels.values()]
    pool = _.filter(pool, c => c.node.advertisement === service)

    return _.sample(pool)
  }

  close () {
    this.channels.forEach(c => c.close())
  }
}
