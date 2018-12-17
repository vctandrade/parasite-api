
module.exports = class Timer {
  constructor (callback, delay) {
    this.callback = callback
    this.delay = delay

    this.timeout = null
  }

  start () {
    if (this.timeout) {
      throw new Error('Timer already started')
    }

    this.timeout = setTimeout(
      () => {
        this.timeout = null
        this.callback()
      },
      this.delay
    )
  }

  stop () {
    clearTimeout(this.timeout)
    this.timeout = null
  }
}
