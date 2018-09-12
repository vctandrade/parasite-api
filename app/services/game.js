const shortid = require('shortid')

module.exports = class Game {
  async createRoom (session) {
    return shortid.generate()
  }
}
