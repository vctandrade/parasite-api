require('dotenv').config()

const config = require('config')
const database = require('./shared/database')
const exitHook = require('exit-hook')
const redis = require('async-redis')
const services = require('./services')
const program = require('commander')

const Discovery = require('./networking/discovery')
const Koa = require('koa')
const Sequelize = require('sequelize')
const Server = require('./networking/server')

const { version } = require('./package.json')

program
  .version(version)
  .description('starts one of the Parasite game servers')
  .arguments('<service>')
  .action(async id => {
    const Service = services[id]

    if (Service === undefined) {
      console.log('Service does not exist')
      return
    }

    const modules = {}
    const sequelize = new Sequelize(config.get('Sequelize'))

    modules.koa = new Koa()
    modules.redis = redis.createClient(config.get('Redis'))
    modules.database = await database.init(sequelize)
    modules.discovery = new Discovery(id, modules.redis)

    const service = new Service(modules)
    const server = new Server(service, modules.koa)

    exitHook(() => {
      server.close()
      modules.discovery.stop()
      modules.redis.quit()
      sequelize.close()
    })
  })

program
  .parse(process.argv)
