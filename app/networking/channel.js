const config = require('config')

const WebSocket = require('ws')

module.exports = class Channel {
  constructor (node) {
    this.nc = 0
    this.ws = null
    this.cb = new Map()

    this.node = node
  }

  async send (data) {
    this.open()

    const id = this.nc++
    const message = JSON.stringify({ id, data })

    this.ws.send(message)
    return id
  }

  async request (data) {
    const id = this.send(data)

    return new Promise((resolve, reject) => {
      this.cb.set(id, resolve)
      setTimeout(
        () => reject(new Error('Timeout')),
        config.get('WebSocket.timeout')
      )
    })
      .finally(() => this.cb.delete(id))
  }

  handle (message) {
    const { id, data } = JSON.parse(message)
    const callback = this.cb.get(id)
    if (callback) callback(data)
  }

  open () {
    if (this.ws) return
    const { address, port } = this.node

    this.ws = new WebSocket(`ws://${address}:${port}`)
    this.ws.on('message', data => this.handle(data))
  }

  close () {
    if (this.ws) this.ws.close()
  }
}
