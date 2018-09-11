const config = require('config')

const EventEmitter = require('events')
const WebSocket = require('ws')

class Session extends EventEmitter {
  constructor (ws) {
    super()

    this.ws = ws
    this.user = null

    ws.on('message', data => {
      this.forward(data)
    })
  }

  forward (data) {
    const request = JSON.parse(data)

    // TODO: validate request

    const route = routes[request.route]
    if (route !== undefined) {
      route(this, request.args)
        .then(value => {
          if (value !== undefined) this.send(request.id, value)
        })
        .catch(reason => {
          console.trace(reason)
        })
    }
  }

  send (id, data) {
    const message = JSON.stringify({ id, data })
    this.ws.send(message)
  }
}

const routes = {
  async login (session, args) {
    const { id } = args

    if (session.user !== null) {
      return { error: 'Already logged in' }
    }

    session.user = { id }
    session.emit('login', id)
  }
}

module.exports = function init () {
  const users = new Map()
  const wss = new WebSocket.Server({
    port: config.get('WebSocket.port')
  })

  wss.on('connection', ws => {
    const s = new Session(ws)

    s.on('login', id => {
      users.set(id, s)

      ws.on('close', () => {
        users.delete(id)
      })
    })

    ws.isAlive = true
    ws.on('ping', heartbeat)
  })

  function heartbeat () {
    this.isAlive = true
  }

  function healthcheck () {
    wss.clients.forEach(ws => {
      if (ws.isAlive) ws.isAlive = false
      else ws.terminate()
    })
  }

  setInterval(healthcheck, config.get('WebSocket.timeout'))
}
