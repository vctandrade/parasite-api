const WebSocket = require('ws')

module.exports = class Session {
  constructor (ws) {
    this.ws = ws
    this.state = {}
  }

  push (data) {
    const message = JSON.stringify({ id: null, data })
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(message)
  }
}
