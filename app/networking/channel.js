const config = require('config')

const WebSocket = require('ws')

module.exports = class Channel {
  constructor (node) {
    this.nc = 0
    this.ws = null
    this.cb = new Map()

    this.node = node
  }

  async send (route, args) {
    await this.open()

    const id = this.nc++
    const message = JSON.stringify({ id, route, args })

    this.ws.send(message)
    return id
  }

  async request (route, args) {
    const id = await this.send(route, args)

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

  async open () {
    if (this.ws) return

    const address = this.node.address
    const port = config.get('WebSocket.port')
    const url = `ws://${address}:${port}`

    this.ws = new WebSocket(url)
    this.ws.on('message', data => this.handle(data))

    var interval
    const wait = new Promise((resolve, reject) => {
      var retries = 5

      const check = () => {
        retries--

        if (this.ws.readyState === WebSocket.OPEN) resolve()
        else if (retries === 0) reject(new Error('Timeout'))
      }

      interval = setInterval(check, 200)
    })

    return wait.finally(() => clearInterval(interval))
  }

  close () {
    if (this.ws) this.ws.close()
  }
}
