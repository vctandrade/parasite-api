const config = require('config')

const EventEmitter = require('events')
const WebSocket = require('ws')

module.exports = class Channel extends EventEmitter {
  constructor (service, hostname) {
    super()

    this.service = service
    this.hostname = hostname

    this.nc = 0
    this.ws = null
    this.cb = new Map()
  }

  async send (route, args) {
    await this.open()
    const message = JSON.stringify({ id: null, route, args })
    this.ws.send(message)
  }

  async request (route, args) {
    await this.open()

    const id = this.nc++
    const message = JSON.stringify({ id, route, args })

    this.ws.send(message)

    const promise = new Promise((resolve, reject) => {
      this.cb.set(id, body => {
        if (body.error === undefined) resolve(body.data)
        else reject(body.error)
      })

      setTimeout(() => reject(new Error('Timeout')), config.get('WebSocket.timeout'))
    })

    return promise
      .finally(() => this.cb.delete(id))
  }

  handle (message) {
    const { id, body } = JSON.parse(message)

    if (id === null) this.emit('push', body)
    else {
      const callback = this.cb.get(id)
      if (callback) callback(body)
    }
  }

  async open () {
    if (this.ws) return

    const port = config.get('WebSocket.port')
    const url = `ws://${this.hostname}:${port}`

    this.ws = new WebSocket(url)
    this.ws.on('message', data => this.handle(data))

    return new Promise(resolve => this.ws.once('open', resolve))
  }

  close () {
    if (this.ws) this.ws.close()
  }
}
