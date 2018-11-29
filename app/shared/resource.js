const EventEmitter = require('events')

module.exports = class Resource extends EventEmitter {
  constructor (value, cap) {
    super()

    this.value = value
    this.cap = cap
  }

  update (delta) {
    const old = this.value
    this.set(this.value + delta)
    return old - this.value
  }

  set (value) {
    this.value = Math.min(Math.max(0, value), this.cap)
    this.emit('update', this.value)
  }

  toJSON () {
    return this.value
  }
}
