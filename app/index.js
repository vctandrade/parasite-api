require('dotenv').config()

const config = require('config')
const exitHook = require('exit-hook')
const redis = require('async-redis')
const services = require('./services')
const program = require('commander')

const Discovery = require('./networking/discovery')
const Server = require('./networking/server')

const { version } = require('./package.json')

program
  .version(version)
  .description('starts one of the Parasite game servers')
  .arguments('<service>')
  .action(function (id) {
    const Service = services[id]

    if (Service === undefined) {
      console.log('Service does not exist')
      return
    }

    const redisClient = redis.createClient(config.get('Redis'))

    const discovery = new Discovery(id, redisClient)
    const service = new Service(discovery, redisClient)
    const server = new Server(service)

    exitHook(() => {
      redisClient.quit()
      discovery.stop()
      server.close()
    })
  })

program
  .parse(process.argv)
