
module.exports = class Connector {
  constructor (proxy) {
    this.proxy = proxy
  }

  async login (session, args) {
    const { id } = args

    if (session.state.user !== undefined) {
      return { error: 'Already logged in' }
    }

    session.state.user = { id }
  }

  async createRoom (session) {
    const channel = this.proxy.get('game')

    channel.on('push', data => session.push(data))
    return channel.request('createRoom', {})
  }
}
