const config = require('config')

const Queue = require('bee-queue')

module.exports = function init () {
  // Example

  const queue = new Queue('jobs', {
    redis: config.get('Redis')
  })

  queue.process(async function (job) {
    console.log(job.data)
    return 'output'
  })
}
