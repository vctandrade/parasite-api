const config = require('config')
const error = require('../shared/error')
const http = require('http')

const Session = require('./session')
const WebSocket = require('ws')

module.exports = class Server {
  constructor (service, koa) {
    this.service = service

    this.http = http
      .createServer(koa.callback())
      .listen(config.get('WebSocket.port'))

    this.http.on('upgrade', (request, socket, head) => {
      this.wss.handleUpgrade(request, socket, head, ws => this.wss.emit('connection', ws, request))
    })

    this.wss = new WebSocket.Server({ noServer: true })

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

    const body = {}
    const method = this.service[route]

    body.data = await this.forward(method, session, args)
      .catch(reason => {
        body.error = reason
      })

    if (id !== null) {
      const message = JSON.stringify({ id, body })
      session.ws.send(message)
    }
  }

  async forward (method, session, args) {
    if (method === undefined) throw error.BAD_REQUEST

    return method.call(this.service, session, args)
      .catch(reason => {
        if (reason instanceof Error) throw error.INTERNAL
        throw reason
      })
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
    this.http.close()
    clearInterval(this.interval)
  }
}
