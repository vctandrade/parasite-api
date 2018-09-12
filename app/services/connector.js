
module.exports = class Connector {
  constructor (proxy) {
    this.proxy = proxy
  }

  async login (session, args) {
    const { id } = args

    if (session.info.user !== undefined) {
      return { error: 'Already logged in' }
    }

    session.info.user = { id }
    session.emit('login', id)
  }

  async createRoom (session) {
    return this.proxy.get('game').request('createRoom', {})
  }
}
