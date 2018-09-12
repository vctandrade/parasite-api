
module.exports = class Game {
  async createRoom (session) {
    setInterval(() => session.push('estado'), 2000)

    return 'connectou'
  }
}
