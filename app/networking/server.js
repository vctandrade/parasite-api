const config = require('config')

const Session = require('./session')
const WebSocket = require('ws')

module.exports = class Server {
  constructor (service) {
    this.service = service

    this.wss = new WebSocket.Server({ port: config.get('WebSocket.port') })
    this.wss.on('connection', ws => {
      const s = new Session(ws)

      ws.isAlive = true

      ws.on('message', data => this.handle(s, data))
      ws.on('pong', () => { ws.isAlive = true })
    })

    this.interval = setInterval(() => this.healthcheck(), config.get('WebSocket.checkInterval'))
  }

  async handle (session, data) {
    const { id, route, args } = JSON.parse(data)

    const method = this.service[route]
    if (method) {
      const data = await method.call(this.service, session, args)
      if (data !== undefined) {
        const message = JSON.stringify({ id, data })
        session.ws.send(message)
      }
    }
  }

  healthcheck () {
    this.wss.clients.forEach(ws => {
      if (ws.isAlive === false) ws.terminate()
      else {
        ws.isAlive = false
        ws.ping()
      }
    })
  }

  close () {
    this.wss.close()
    clearInterval(this.interval)
  }
}
