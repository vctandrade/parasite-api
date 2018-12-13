const config = require('config')

const EventEmitter = require('events')
const WebSocket = require('ws')

module.exports = class Channel extends EventEmitter {
  constructor (service, hostname) {
    super()

    this.setMaxListeners(0)

    this.service = service
    this.hostname = hostname

    const port = config.get('WebSocket.port')
    const url = `ws://${hostname}:${port}`

    this.nc = 0
    this.ws = new WebSocket(url)
    this.cb = new Map()

    this.ws.on('message', data => this.handle(data))
    this.ws.on('ping', () => { this.isAlive = true })
    this.ws.on('close', () => this.close())
    this.ws.on('error', err => console.error('Error:', this.toString(), err.message))

    this.interval = setInterval(() => this.healthcheck(), config.get('WebSocket.checkInterval'))
  }

  async send (route, args) {
    const message = JSON.stringify({ id: null, route, args })
    this.ws.send(message)
  }

  async request (route, args) {
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

  async handle (message) {
    const { id, body } = JSON.parse(message)

    if (id === null) this.emit('push', body)
    else {
      const callback = this.cb.get(id)
      if (callback) callback(body)
    }
  }

  healthcheck () {
    if (this.isAlive) this.isAlive = false
    else this.close()
  }

  close () {
    clearInterval(this.interval)
    this.ws.close()
    this.emit('close')
  }

  toString () {
    return `Channel{service="${this.service}" host="${this.host}"}`
  }
}
