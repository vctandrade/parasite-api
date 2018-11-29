
module.exports = class Session {
  constructor (ws) {
    this.ws = ws

    this.player = null
    this.gameID = null
    this.hostname = null

    this.disconnector = () => {
      this.gameID = null
      this.hostname = null

      this.push('disconnect')
    }
  }

  async push (topic, data) {
    const body = { topic, data }
    const message = JSON.stringify({ id: null, body })

    this.ws.send(message)
  }
}
