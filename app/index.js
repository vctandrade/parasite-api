const config = require('config')
const exitHook = require('exit-hook')
const services = require('./services')
const program = require('commander')

const Discover = require('node-discover')
const Proxy = require('./networking/proxy')

program
  .version('0.1.0')
  .description('starts one of the Parasite game servers')
  .arguments('<service>')
  .action(function (service) {
    const init = services[service]

    if (init === undefined) {
      console.log('Service does not exist')
      return
    }

    const d = Discover(config.get('Discover'))
    const p = new Proxy()

    d.on('added', node => p.add(node))
    d.on('removed', node => p.remove(node))
    d.advertise(service)

    exitHook(() => d.stop(), p.close())
    init(p)
  })

program
  .parse(process.argv)
