require('dotenv').config()

const config = require('config')
const exitHook = require('exit-hook')
const services = require('./services')
const program = require('commander')

const Discovery = require('./networking/discovery')
const Koa = require('koa')
const Server = require('./networking/server')

const { createClient } = require('async-redis')
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

    const redis = createClient(config.get('Redis'))
    const koa = new Koa()

    const discovery = new Discovery(id, redis)
    const service = new Service(discovery, redis, koa)
    const server = new Server(service, koa)

    exitHook(() => {
      redis.quit()
      discovery.stop()
      server.close()
    })
  })

program
  .parse(process.argv)
