const config = require('config')

const Queue = require('bee-queue')

module.exports = function init () {
  // Example

  const queue = new Queue('jobs', {
    redis: config.get('Redis'),
    isWorker: false
  })

  const job = queue.createJob('input')

  job
    .timeout(3000)
    .retries(2)
    .save()

  job
    .on('succeeded', console.log)
}
