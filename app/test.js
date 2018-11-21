require('dotenv').config()

const WebSocket = require('ws')

const p1 = new WebSocket('ws://localhost:5000')
const p2 = new WebSocket('ws://localhost:5000')

const input = () => new Promise(async resolve => {
  await sleep(1000)
  console.log('Press ENTER...')
  process.stdin.once('data', function () {
    resolve()
  })
})

const sleep = ms => new Promise(resolve => {
  setTimeout(resolve, ms)
})

const anwser = ws => new Promise(resolve => {
  ws.once('message', data => resolve(JSON.parse(data)))
})

function init (ws, name) {
  ws.on('message', data => console.log(name, data))
  ws.on('close', () => console.log('close', name))

  return new Promise(resolve => {
    ws.once('open', resolve)
  })
}

Promise.all([
  init(p1, 'A'),
  init(p2, 'B')
])
  .then(async () => {
    console.log('Connected...')

    let buffer

    // p1.send(JSON.stringify({ id: 'info', route: 'info' }))
    // await anwser(p1)

    // p1.send(JSON.stringify({ id: 'createGame -> UNAUTHORIZED', route: 'createGame', args: { roster: ['manager', 'scientist'] } }))
    // await anwser(p1)
    //
    // p1.send(JSON.stringify({ id: 'execute -> UNAUTHORIZED', route: 'execute', args: { action: 'move', target: 'kitchen' } }))
    // await anwser(p1)
    //
    // p1.send(JSON.stringify({ id: 'oauth -> UNAUTHORIZED', route: 'oauth', args: { token: 'invalid' } }))
    // await anwser(p1)

    // p1.send(JSON.stringify({ id: 'oauth', route: 'oauth', args: { token: process.env.TOKEN_1 } }))
    // buffer = await anwser(p1)

    // p1.send(JSON.stringify({ id: 'login -> UNAUTHORIZED', route: 'login', args: { token: 'invalid' } }))
    // await anwser(p1)
    //
    // p1.send(JSON.stringify({ id: 'logout -> UNAUTHORIZED', route: 'logout' }))
    // await anwser(p1)

    // p1.send(JSON.stringify({ id: 'login', route: 'login', args: { token: buffer.body.data.token } }))
    // await anwser(p1)
    //
    // p1.send(JSON.stringify({ id: 'logout', route: 'logout' }))
    // await anwser(p1)

    p1.send(JSON.stringify({ id: 'login', route: 'login', args: { token: /* buffer.body.data.token */ 'f721a9d5-46f9-4d96-9a8f-c619b492ea3f' } }))
    await anwser(p1)

    // p1.send(JSON.stringify({ id: 'login -> MULTIPLE_LOGIN', route: 'login', args: { token: buffer.body.data.token } }))
    // await anwser(p1)

    // p1.send(JSON.stringify({ id: 'uodateAccount', route: 'updateAccount', args: { name: 'Mari' } }))
    // await anwser(p1)

    // p1.send(JSON.stringify({ id: 'createGame -> BAD_REQUEST', route: 'createGame', args: { roster: ['popstar', 'janitor'] } }))
    // await anwser(p1)

    p1.send(JSON.stringify({ id: 'createGame', route: 'createGame', args: { roster: ['electricist', 'cook'] } }))
    buffer = await anwser(p1)

    const gameID = buffer.body.data.gameID

    // p1.send(JSON.stringify({ id: 'joinGame -> BAD_REQUEST', route: 'joinGame', args: { gameID: 'invalid' } }))
    // await anwser(p1)

    p1.send(JSON.stringify({ id: 'joinGame', route: 'joinGame', args: { gameID } }))
    await anwser(p1)

    // p1.send(JSON.stringify({ id: 'joinGame -> MULTIPLE_JOIN', route: 'joinGame', args: { gameID: buffer.body.data.gameID } }))
    // await anwser(p1)

    // p2.send(JSON.stringify({ id: 'oauth', route: 'oauth', args: { token: process.env.TOKEN_2 } }))
    // buffer = await anwser(p2)

    p2.send(JSON.stringify({ id: 'login', route: 'login', args: { token: /* buffer.body.data.token */ '3c5afa64-55d4-49e9-ac6e-6c7c5b0fe738' } }))
    await anwser(p2)

    p2.send(JSON.stringify({ id: 'updateAccount', route: 'updateAccount', args: { name: 'Arthur' } }))
    await anwser(p2)

    p2.send(JSON.stringify({ id: 'joinGame', route: 'joinGame', args: { gameID } }))
    await anwser(p2)

    await sleep(16000)
    await input()

    while (true) {
      // p1.send(JSON.stringify({ id: 'execute.nothing -> BAD_REQUEST', route: 'execute', args: { action: 'nothing' } }))
      // await anwser(p1)
      //
      // p1.send(JSON.stringify({ id: 'execute.move -> BAD_REQUEST', route: 'execute', args: { action: 'move', target: 'bathroom' } }))
      // await anwser(p1)

      p1.send(JSON.stringify({ id: 'execute.move', route: 'execute', args: { action: 'move', target: 'kitchen' } }))
      await anwser(p1)

      p2.send(JSON.stringify({ id: 'execute.move', route: 'execute', args: { action: 'move', target: 'kitchen' } }))
      await anwser(p2)

      // p2.send(JSON.stringify({ id: 'execute.nothing -> BAD_REQUEST', route: 'execute', args: { action: 'nothing' } }))
      // await anwser(p2)
      //
      // p1.send(JSON.stringify({ id: 'execute.jump -> BAD_REQUEST', route: 'execute', args: { action: 'jump' } }))
      // await anwser(p1)
      //
      // p1.send(JSON.stringify({ id: 'execute.move -> BAD_REQUEST', route: 'execute', args: { action: 'move', target: 'kitchen' } }))
      // await anwser(p1)

      p1.send(JSON.stringify({ id: 'execute.cook', route: 'execute', args: { action: 'cook' } }))
      buffer = await anwser(p1)

      if (buffer.body.error) {
        p1.send(JSON.stringify({ id: 'execute.nothing', route: 'execute', args: { action: 'nothing' } }))
        await anwser(p1)
      }

      p2.send(JSON.stringify({ id: 'execute.eat', route: 'execute', args: { action: 'eat' } }))
      await anwser(p2)

      p1.send(JSON.stringify({ id: 'execute.ready', route: 'execute', args: { action: 'ready' } }))
      await anwser(p1)

      p2.send(JSON.stringify({ id: 'execute.ready', route: 'execute', args: { action: 'ready' } }))
      await anwser(p2)

      await input()
    }
  })
