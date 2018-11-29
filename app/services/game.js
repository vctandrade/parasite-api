const _ = require('lodash')

const actions = require('../shared/actions')
const error = require('../shared/error')
const locations = require('../shared/locations')
const roster = require('../shared/roster')
const shortid = require('shortid')

const EventEmitter = require('events')
const Resource = require('../shared/resource')

class Player {
  constructor (id, name, session) {
    this.id = id
    this.name = name
    this.session = session

    this.pid = shortid.generate()

    this.state = null
    this.job = null
    this.genotype = null
    this.location = null
    this.snapshot = null

    this.conditions = {
      confused: false,
      hidden: false,
      sick: false
    }

    this.resources = {
      health: new Resource(10, 10),
      stamina: new Resource(10, 10),
      nutrition: new Resource(10, 10)
    }

    this.resources.health.on('update', value => {
      if (value === 0) this.state = 'dead'
    })
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
          genotype: player.genotype,
          resources: player.resources,
          conditions: player.conditions,
          state: player.state
        },
        location: {
          name: player.location,
          players: _.filter(this.game.players, other => {
            if (other === player) return false
            if (other.location !== player.location) return false
            if (other.conditions.hidden) return false
            return true
          })
            .map(other => {
              return {
                id: other.pid,
                name: player.conditions.confused ? '???' : other.name,
                state: other.state,
                genotype: player.genotype === null ? undefined : other.genotype
              }
            })
        },
        resources: player.snapshot,
        days: this.game.days
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

    const winner = this.getWinner()

    if (winner) {
      this.game.phase = new End(this.game, winner)
      this.game.close()
    }

    this.game.push(player.id)
    return { state: this.game.phase.view(player) }
  }

  getWinner () {
    if (_.every(this.game.players, player => player.state === 'dead' || player.genotype !== null) || this.game.resources.energy.value === 0) return 'infected'
    if (_.every(this.game.players, player => player.state === 'dead' || player.genotype === null) || this.game.days === 0) return 'humans'
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

    this.remaining = 0

    this.game.resources.energy.update(this.game.resources.generator.value - 10)
    this.game.resources.generator.update(-1)

    const snapshot = _.clone(this.game.resources)

    game.players.forEach(player => {
      player.snapshot = snapshot

      if (player.conditions.sick) player.resources.health.update(-1)
      player.conditions.confused = false

      player.resources.health.update(Math.min(0, player.resources.nutrition.value - 2) * 2)
      player.resources.nutrition.update(-2)

      if (player.state === 'dead') return

      player.state = 'idle'
      player.location = 'courtyard'
      player.conditions.hidden = false

      this.remaining += 1
    })
  }

  getActions (player) {
    return {
      ready: target => {
        player.state = 'busy'

        if (--this.remaining === 0) {
          this.game.phase = new Dawn(this.game)
          this.game.days -= 1
        }
      }
    }
  }
}

class Lobby {
  constructor (game, jobs, genotypes) {
    this.game = game

    this.jobs = jobs
    this.genotypes = genotypes

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

    return {
      jobs: this.jobs,
      genotypes: this.genotypes,

      state: this.view(player)
    }
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
    _.zipWith(this.game.players, _.shuffle(this.jobs), _.shuffle(this.genotypes), (player, job, genotype) => {
      player.job = job
      player.genotype = genotype || null
    })

    this.game.days = 30
    this.game.base = locations.createBase()
    this.game.resources = {
      energy: new Resource(50, 50),
      food: new Resource(0, 50),
      remedy: new Resource(0, 50),
      generator: new Resource(10, 10)
    }

    this.game.phase = new Dawn(this.game)
    this.game.push()
  }

  isFull () {
    return this.game.players.length === this.jobs.length
  }
}

class End {
  constructor (game, winner) {
    this.game = game
    this.winner = winner
  }

  view (player) {
    return {
      phase: 'end',
      info: {
        win: (player.genotype === null) === (this.winner === 'humans'),
        players: this.game.players
          .map(other => {
            return {
              name: other.name,
              job: other.job,
              genotype: other.genotype,
              alive: other.state !== 'dead'
            }
          }),
        resources: this.game.resources,
        days: this.game.days
      }
    }
  }

  join (playerID, playerName, session) {
    throw error.GAME_FULL
  }

  leave (playerID) {
  }

  execute (player, action, target) {
    throw error.BAD_REQUEST
  }
}

class Game extends EventEmitter {
  constructor (jobs, genotypes) {
    super()

    if (_.some(jobs, job => _.includes(roster.jobs, job) === false)) throw error.BAD_REQUEST
    if (_.some(genotypes, genotype => _.includes(roster.genotypes, genotype) === false)) throw error.BAD_REQUEST

    this.phase = new Lobby(this, jobs, genotypes)
    this.players = []

    this.base = null
    this.resources = null
    this.days = null
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
    this.emit('close')

    this.players.forEach(player => {
      player.push('internal', { route: 'leaveGame' })
    })
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
    const { jobs, genotypes } = args

    if (
      jobs.length < 2 ||
      jobs.length <= genotypes.length ||
      genotypes.length < 1

    ) throw error.BAD_REQUEST

    const gameID = shortid.generate()
    const game = new Game(jobs, genotypes)

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
