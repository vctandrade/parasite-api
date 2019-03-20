const _ = require('lodash')

const config = require('config')

const Channel = require('./channel')
const EventEmitter = require('events')

module.exports = class Discovery extends EventEmitter {
  constructor (service, redis) {
    super()

    this.channels = new Map()

    this.service = service
    this.hostname = config.util.getEnv('HOSTNAME')

    this.pub = redis
    this.sub = redis.duplicate()

    this.sub.on('message', (topic, message) => {
      const { service, hostname } = JSON.parse(message)

      if (hostname === this.hostname || this.channels.has(hostname)) return

      const channel = new Channel(service, hostname)

      channel.on('push', body => this.emit('push', body))
      channel.on('close', () => this.channels.delete(hostname))

      this.channels.set(hostname, channel)
    })

    this.sub.subscribe('discovery')
    this.interval = setInterval(() => this.advertise(), config.get('Discovery.interval'))
  }

  advertise () {
    const message = JSON.stringify({
      service: this.service,
      hostname: this.hostname
    })

    this.pub.publish('discovery', message)
  }

  get (hostname) {
    return this.channels.get(hostname)
  }

  getAny (service) {
    return _
      .chain(this.channels)
      .invoke('values')
      .thru(Array.from)
      .filter(c => c.service === service)
      .sample()
      .value()
  }

  stop () {
    clearInterval(this.interval)
    this.channels.forEach(c => c.close())
    this.sub.quit()
  }
}
