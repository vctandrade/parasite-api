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
    this.canAct = false

    this.job = null
    this.location = null

    this.resources = {
      health: 10,
      stamina: 10
    }
  }

  push (topic, data) {
    if (this.session) this.session.push(topic, { playerID: this.id, content: data })
  }

  toJSON () {
    return this.name
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
          canAct: player.canAct
        },
        location: {
          name: player.location,
          players: _.filter(this.game.players, other => other.location === player.location)
        },
        resources: this.game.resources
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
    if (player.canAct === false) throw error.BAD_REQUEST

    const actions = this.getActions(player)
    const method = actions[action]

    if (method === undefined) throw error.BAD_REQUEST

    return method(target)
  }
}

class Day extends AbstractPhase {
  constructor (game) {
    super('day', game)

    game.players.forEach(player => {
      player.location = null
      player.canAct = true
    })

    this.initiative = []
  }

  getActions (player) {
    return {
      move: target => {
        const location = this.game.base[target]

        if (location === undefined) throw error.BAD_REQUEST

        player.location = location
        player.canAct = false

        this.initiative.push(player)

        if (this.initiative.length === this.game.players.length) {
          this.game.phase = new Night(this.game, this.initiative)
        }

        this.game.push(player.id)
        return { state: this.game.phase.view(player) }
      }
    }
  }
}

class Night extends AbstractPhase {
  constructor (game, initiative) {
    super('night', game)

    const next = initiative.shift()
    next.canAct = true

    this.initiative = initiative
  }

  getActions (player) {
    return _.mapValues(actions, action => this.wrap(player, action))
  }

  wrap (player, method) {
    return target => {
      method(this.game, player, target)

      player.canAct = false
      const next = this.initiative.shift()

      if (next === undefined) {
        this.game.resources.energy = Math.max(this.game.resources.energy - 10, 0)

        this.game.phase = new Day(this.game)
        this.game.push(player.id)
      } else {
        next.canAct = true
        next.push('state', this.view(next))
      }

      return { state: this.game.phase.view(player) }
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
        players: this.game.players,
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

    this.game.base = locations.createBase()
    this.game.resources = {
      energy: 100,
      food: 5,
      remedy: 3
    }

    this.game.phase = new Day(this.game)
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
