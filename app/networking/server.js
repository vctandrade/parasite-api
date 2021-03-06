const config = require('config')
const error = require('../shared/error')
const http = require('http')

const Session = require('./session')
const WebSocket = require('ws')

module.exports = class Server {
  constructor (service, koa) {
    this.service = service

    this.external = http.createServer(koa.callback())
    this.internal = http.createServer()

    const handleUpgrade = (request, socket, head, source) => {
      this.wss.handleUpgrade(request, socket, head, ws => {
        ws.source = source
        this.wss.emit('connection', ws, request)
      })
    }

    this.external.on('upgrade', (request, socket, head) => {
      handleUpgrade(request, socket, head, 'external')
    })

    this.internal.on('upgrade', (request, socket, head) => {
      handleUpgrade(request, socket, head, 'internal')
    })

    this.wss = new WebSocket.Server({ noServer: true })

    this.wss.on('connection', ws => {
      ws.isAlive = true

      const session = new Session(ws)

      ws.on('message', data => this.handle(session, data))
      ws.on('pong', () => { ws.isAlive = true })
    })
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
        if (reason instanceof Error) {
          console.error('Internal Error:', reason)
          throw error.INTERNAL
        } else {
          throw reason
        }
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

  start () {
    this.external.listen(config.get('WebSocket.externalPort'))
    this.internal.listen(config.get('WebSocket.internalPort'))

    this.interval = setInterval(() => this.healthcheck(), config.get('WebSocket.checkInterval'))
  }

  close () {
    this.external.close()
    this.internal.close()

    clearInterval(this.interval)
  }
}
