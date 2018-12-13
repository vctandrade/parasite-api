
module.exports = class Session {
  constructor (ws) {
    ws.setMaxListeners(0)

    this.ws = ws
  }

  async push (topic, data) {
    const body = { topic, data }
    const message = JSON.stringify({ id: null, body })

    this.ws.send(message)
  }
}
