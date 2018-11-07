const _ = require('lodash')

const actions = require('../shared/actions')
const error = require('../shared/error')
const jobs = require('../shared/jobs')
const locations = require('../shared/locations')
const shortid = require('shortid')

const EventEmitter = require('events')

class Player {
  constructor (id, name, session) {
    this.id = id
    this.name = name
    this.session = session

    this.infected = false

    this.state = null
    this.job = null
    this.location = null
    this.snapshot = null

    this.resources = {
      health: 10,
      stamina: 10,
      hunger: 10
    }
  }

  damage (value) {
    this.resources.health = Math.max(this.resources.health - value, 0)
    if (this.resources.health === 0) this.state = 'dead'
  }

  push (topic, data) {
    if (this.session) this.session.push(topic, { playerID: this.id, content: data })
  }
}

class AbstractPhase {
  constructor (name, game) {
    this.name = name
    this.game = game
  }

  view (player) {
    return {
      phase: this.name,
      info: {
        player: {
          name: player.name,
          job: player.job,
          infected: player.infected,
          resources: player.resources,
          state: player.state
        },
        location: {
          name: player.location,
          players: _.filter(this.game.players, other => other.location === player.location && other.id !== player.id).map(other => {
            return {
              id: other.id,
              name: other.name,
              state: other.state,
              infected: player.infected ? other.infected : null
            }
          })
        },
        resources: player.snapshot,
        round: this.game.round
      }
    }
  }

  join (playerID, playerName, session) {
    const player = _.find(this.game.players, { id: playerID })

    if (player === undefined) throw error.GAME_FULL

    player.session = session

    return { state: this.view(player) }
  }

  leave (playerID) {
    const player = _.find(this.game.players, { id: playerID })
    player.session = null
  }

  execute (player, action, target) {
    if (player.state !== 'idle') throw error.BAD_REQUEST

    const actions = this.getActions(player)
    const method = actions[action]

    if (method === undefined) throw error.BAD_REQUEST

    method(target)

    this.game.push(player.id)
    return { state: this.game.phase.view(player) }
  }
}

class Dawn extends AbstractPhase {
  constructor (game) {
    super('dawn', game)

    const snapshot = _.clone(this.game.resources)

    this.initiative = []
    this.remaining = 0

    game.players.forEach(player => {
      player.snapshot = snapshot

      if (player.state === 'dead') return

      player.state = 'idle'
      player.location = 'courtyard'

      this.remaining += 1
    })
  }

  getActions (player) {
    return {
      move: target => {
        const location = this.game.base[target]

        if (location === undefined) throw error.BAD_REQUEST

        player.location = location
        player.state = 'busy'

        this.initiative.push(player)

        if (--this.remaining === 0) {
          this.game.phase = new Day(this.game, this.initiative)
        }
      }
    }
  }
}

class Day extends AbstractPhase {
  constructor (game, initiative) {
    super('day', game)

    initiative.shift().state = 'idle'
    this.initiative = initiative
  }

  getActions (player) {
    return _.mapValues(actions, action => this.wrap(player, action))
  }

  wrap (player, method) {
    return target => {
      method(this.game, player, target)

      const snapshot = _.clone(this.game.resources)

      player.state = 'busy'
      player.snapshot = snapshot

      while (true) {
        const next = this.initiative.shift()

        if (next === undefined) {
          this.game.phase = new Night(this.game)
          break
        }

        if (next.state === 'busy') {
          next.state = 'idle'
          next.snapshot = snapshot
          break
        }
      }
    }
  }
}

class Night extends AbstractPhase {
  constructor (game) {
    super('night', game)

    const snapshot = _.clone(this.game.resources)

    this.remaining = 0

    game.players.forEach(player => {
      player.snapshot = snapshot

      if (player.state === 'dead') return

      player.state = 'idle'
      player.location = 'courtyard'

      this.remaining += 1
    })
  }

  getActions (player) {
    return {
      ready: target => {
        player.state = 'busy'

        if (--this.remaining === 0) {
          this.game.resources.energy = Math.max(this.game.resources.energy + this.game.resources.generator - 10, 0)
          this.game.resources.generator = Math.max(this.game.resources.generator - 1, 0)

          this.game.players.forEach(player => {
            player.resources.hunger -= 2

            if (player.resources.hunger < 0) {
              player.damage(-player.resources.hunger)
              player.resources.hunger = 0
            }
          })

          this.game.phase = new Dawn(this.game)
          this.game.round += 1
        }
      }
    }
  }
}

class Lobby {
  constructor (game, roster) {
    this.game = game
    this.roster = roster

    this.startTime = null
    this.timer = null
  }

  view (player) {
    return {
      phase: 'lobby',
      info: {
        players: this.game.players.map(other => other.name),
        startTime: this.startTime
      }
    }
  }

  join (playerID, playerName, session) {
    if (this.isFull()) throw error.GAME_FULL

    const player = new Player(playerID, playerName, session)
    this.game.players.push(player)

    if (this.isFull()) {
      this.timer = setTimeout(() => this.begin(), 15000)
      this.startTime = Date.now() + 15000
    }

    this.game.push(playerID)

    return { roster: this.roster, state: this.view(player) }
  }

  leave (playerID) {
    _.remove(this.game.players, player => player.id === playerID)

    clearTimeout(this.timer)
    this.timer = null
    this.startTime = null

    this.game.push(playerID)
  }

  execute (player, action, target) {
    throw error.BAD_REQUEST
  }

  begin () {
    const parasite = []
    const size = this.game.players.length

    for (let i = 0; i < size; ++i) {
      parasite.push(i >= Math.floor(size / 2))
    }

    _.zipWith(this.game.players, _.shuffle(this.roster), _.shuffle(parasite), (player, job, infected) => {
      player.job = job
      player.infected = infected
    })

    this.game.round = 1
    this.game.base = locations.createBase()
    this.game.resources = {
      energy: 50,
      food: 0,
      remedy: 0,
      generator: 10
    }

    this.game.phase = new Dawn(this.game)
    this.game.push()
  }

  isFull () {
    return this.game.players.length === this.roster.length
  }
}

class Game extends EventEmitter {
  constructor (roster) {
    super()

    if (_.some(roster, job => _.includes(jobs, job) === false)) throw error.BAD_REQUEST

    this.phase = new Lobby(this, roster)
    this.players = []

    this.base = null
    this.resources = null
    this.round = null
  }

  join (playerID, playerName, session) {
    return this.phase.join(playerID, playerName, session)
  }

  leave (playerID) {
    return this.phase.leave(playerID)
  }

  execute (playerID, action, target) {
    const player = _.find(this.players, { id: playerID })
    return this.phase.execute(player, action, target)
  }

  close () {
    this.push('kick')
    this.emit('close')
  }

  push (playerID) {
    this.players.forEach(player => {
      if (player.id !== playerID) player.push('state', this.phase.view(player))
    })
  }
}

module.exports = class {
  constructor (modules) {
    const { redis } = modules

    this.redis = redis
    this.games = new Map()
  }

  async createGame (session, args) {
    const { roster } = args

    if (roster.length < 2) throw error.BAD_REQUEST

    const gameID = shortid.generate()
    const game = new Game(roster)

    this.games.set(gameID, game)

    game.once('close', () => {
      this.redis.hdel('game', gameID)
      this.games.delete(gameID)
    })

    return { gameID }
  }

  async joinGame (session, args) {
    const { playerID, playerName, gameID } = args

    const game = this.games.get(gameID)
    session.ws.once('close', () => game.leave(playerID))

    return game.join(playerID, playerName, session)
  }

  async leaveGame (session, args) {
    const { playerID, gameID } = args

    const game = this.games.get(gameID)
    return game.leave(playerID)
  }

  async execute (session, args) {
    const { playerID, gameID, action, target } = args

    const game = this.games.get(gameID)
    return game.execute(playerID, action, target)
  }
}
