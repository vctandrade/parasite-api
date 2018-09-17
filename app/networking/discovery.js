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

    this.sub.on('message', (channel, message) => {
      const { service, hostname } = JSON.parse(message)
      const c = this.channels.get(hostname)

      if (c !== undefined) c.isAlive = true
      else {
        const c = new Channel(service, hostname)
          .on('push', body => this.emit(service, body))

        c.isAlive = true
        this.channels.set(hostname, c)
      }
    })

    this.sub.subscribe('discovery')
    this.interval = setInterval(() => this.heartbeat(), config.get('Discovery.interval'))
  }

  heartbeat () {
    const message = JSON.stringify(this.ad)

    this.pub.publish('discovery', message)
    this.channels.forEach(c => {
      if (c.isAlive) c.isAlive = false
      else {
        c.close()
        this.channels.delete(c.hostname)
      }
    })
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
