
module.exports = class Resource {
  constructor (value, cap) {
    this.value = value
    this.cap = cap
  }

  update (delta) {
    this.set(this.value + delta)
  }

  set (value) {
    this.value = Math.min(Math.max(0, value), this.cap)
  }

  toJSON () {
    return this.value
  }
}
