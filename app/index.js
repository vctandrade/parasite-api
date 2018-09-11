const config = require('config')
const exitHook = require('exit-hook')
const services = require('./services')
const program = require('commander')

const Discover = require('node-discover')

program
  .version('0.1.0')
  .description('starts one of the Parasite game servers')
  .arguments('<target>')
  .action(function (target) {
    const init = services[target]

    if (init === undefined) {
      console.log('Service does not exist')
      return
    }

    const d = Discover(config.get('Discover'))

    exitHook(d.stop)
    init(d)
  })

program
  .parse(process.argv)
