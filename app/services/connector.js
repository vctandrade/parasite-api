const config = require('config')
const exitHook = require('exit-hook')

const EventEmitter = require('events')
const WebSocket = require('ws')

class Session extends EventEmitter {
  constructor (ws) {
    super()

    this.ws = ws
    this.info = {}

    ws.on('message', data => this.handle(data))
  }

  handle (data) {
    const { id, route, args } = JSON.parse(data)

    const method = routes[route]
    if (method) {
      method(this, args)
        .then(data => {
          if (data !== undefined) {
            const message = JSON.stringify({ id, data })
            this.ws.send(message)
          }
        })
        .catch(console.trace)
    }
  }
}

const routes = {
  async login (session, args) {
    const { id } = args

    if (session.info.user !== undefined) {
      return { error: 'Already logged in' }
    }

    session.info.user = { id }
    session.emit('login', id)
  },

  async createRoom (session) {
  }
}

module.exports = function init (p) {
  const users = new Map()
  const wss = new WebSocket.Server({
    port: config.get('WebSocket.port')
  })

  wss.on('connection', ws => {
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })

    const s = new Session(ws)

    s.once('login', id => {
      users.set(id, s)
      ws.once('close', () => users.delete(id))
    })
  })

  function healthcheck () {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) ws.terminate()
      else {
        ws.isAlive = false
        ws.ping()
      }
    })
  }

  setInterval(healthcheck, config.get('WebSocket.checkInterval'))
  exitHook(() => wss.close())
}
