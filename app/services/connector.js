const config = require('config')

const EventEmitter = require('events')
const Queue = require('bee-queue')
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
        .catch(error => {
          console.trace(error)
        })
    }
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
  },

  async createRoom (session) {
    const job = await getQueue('create-room').createJob().save()

    return new Promise((resolve, reject) => {
      job.on('succeeded', resolve)
      job.on('failed', reject)
    })
  }
}

// TODO: refactor and graceful shutdown
const queues = {}
function getQueue (name) {
  const settings = {
    redis: config.get('Redis'),
    isWorker: false
  }

  if (queues[name] === undefined) {
    queues[name] = new Queue(name, settings)
  }

  return queues[name]
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
