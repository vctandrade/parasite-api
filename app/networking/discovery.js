const _ = require('lodash')

const config = require('config')
const os = require('os')

const Channel = require('./channel')
const EventEmitter = require('events')

module.exports = class Discovery extends EventEmitter {
  constructor (service, redisClient) {
    super()

    this.channels = new Map()

    this.ad = {
      service, hostname: os.hostname()
    }

    this.pub = redisClient
    this.sub = redisClient.duplicate()

    this.sub.on('message', (topic, message) => {
      const { service, hostname } = JSON.parse(message)

      if (hostname === this.ad.hostname || this.channels.has(hostname)) return

      const channel = new Channel(service, hostname)

      channel.on('push', body => this.emit(service, body))
      channel.on('close', () => this.channels.delete(hostname))

      this.channels.set(hostname, channel)
    })

    this.sub.subscribe('discovery')
    this.interval = setInterval(() => this.advertise(), config.get('Discovery.interval'))
  }

  advertise () {
    const message = JSON.stringify(this.ad)
    this.pub.publish('discovery', message)
  }

  get (hostname) {
    return this.channels.get(hostname)
  }

  getAny (service) {
    let pool

    pool = [...this.channels.values()]
    pool = _.filter(pool, c => c.service === service)

    return _.sample(pool)
  }

  stop () {
    clearInterval(this.interval)
    this.channels.forEach(c => c.close())
    this.sub.quit()
  }
}
