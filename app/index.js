const config = require('config')
const modules = require('./modules')
const program = require('commander')

const Discover = require('node-discover')

program
  .version('0.1.0')
  .description('starts one of the Parasite game servers')
  .arguments('<module>')
  .action(function (module) {
    const init = modules[module]

    if (init === undefined) {
      console.log('Module does not exist')
      return
    }

    const discover = Discover(config.get('Discover'))
    discover.advertise(module)
    init(discover)
  })

program
  .parse(process.argv)
