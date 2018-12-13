
module.exports = class Timer {
  constructor (callback, delay) {
    this.callback = callback
    this.delay = delay

    this.timeout = null
  }

  start () {
    if (this.timeout !== null) {
      throw new Error('Timer already started')
    }

    this.timeout = setTimeout(this.callback, this.delay)
    return Date.now() + this.delay
  }

  stop () {
    clearTimeout(this.timeout)
    this.timeout = null
  }
}
