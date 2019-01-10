require('dotenv').config()

const config = require('config')
const exitHook = require('exit-hook')
const services = require('./services')
const program = require('commander')

const Database = require('./shared/database')
const Discovery = require('./networking/discovery')
const Koa = require('koa')
const Redis = require('ioredis')
const Redlock = require('redlock')
const Sequelize = require('sequelize')
const Server = require('./networking/server')

const { version } = require('./package.json')

function abort (err) {
  console.error(`${err.name}: ${err.message}`)
  process.exit(1)
}

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
    modules.redis = new Redis(config.get('Redis'))
    modules.database = new Database(sequelize)
    modules.discovery = new Discovery(id, modules.redis)
    modules.redlock = new Redlock(
      [modules.redis]
    )

    const service = new Service(modules)
    const server = new Server(service, modules.koa)

    exitHook(() => {
      server.close()
      modules.discovery.stop()
      modules.redis.quit()
      sequelize.close()
    })

    await sequelize.sync()
      .catch(abort)

    server.start()
  })

program
  .parse(process.argv)
