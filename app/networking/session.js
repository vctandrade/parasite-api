
module.exports = class Session {
  constructor (ws) {
    this.ws = ws
    this.state = {}
  }

  async push (topic, data) {
    const body = { topic, data }
    const message = JSON.stringify({ id: null, body })

    this.ws.send(message)
  }
}
