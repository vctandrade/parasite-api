const config = require('config')
const exitHook = require('exit-hook')
const services = require('./services')
const program = require('commander')

const Discover = require('node-discover')
const Proxy = require('./networking/proxy')
const Server = require('./networking/server')

program
  .version('0.2.0')
  .description('starts one of the Parasite game servers')
  .arguments('<service>')
  .action(function (id) {
    const Service = services[id]

    if (Service === undefined) {
      console.log('Service does not exist')
      return
    }

    const d = new Discover(config.get('Discover'))
    const p = new Proxy()
    const s = new Server(new Service(p))

    d.on('added', node => p.add(node))
    d.on('removed', node => p.remove(node))
    d.advertise(id)

    exitHook(() => {
      d.stop()
      p.close()
      s.close()
    })
  })

program
  .parse(process.argv)
