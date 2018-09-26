const config = require('config')
const error = require('../shared/error')

const Session = require('./session')
const WebSocket = require('ws')

module.exports = class Server {
  constructor (service) {
    this.service = service

    this.wss = new WebSocket.Server({ port: config.get('WebSocket.port') })
    this.wss.on('connection', ws => {
      ws.isAlive = true

      const session = new Session(ws)

      ws.on('message', data => this.handle(session, data))
      ws.on('pong', () => { ws.isAlive = true })
    })

    this.interval = setInterval(() => this.healthcheck(), config.get('WebSocket.checkInterval'))
  }

  async handle (session, data) {
    const { id, route, args } = JSON.parse(data)

    const method = this.service[route]
    if (method) {
      const body = {}

      body.data = await method.call(this.service, session, args)
        .catch(reason => {
          if (reason instanceof Error) {
            console.error(reason)
            reason = error.INTERNAL_ERROR
          }

          body.error = reason
        })

      if (id !== null) {
        const message = JSON.stringify({ id, body })
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
