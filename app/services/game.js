const _ = require('lodash')

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
          resources: player.resources,
          canAct: player.canAct
        },
        location: {
          name: player.location,
          players: _.filter(this.game.players, other => other.location === player.location)
        },
        resources: this.resources
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

    player.canAct = false
    return method(player, target)
  }
}

class Day extends AbstractPhase {
  constructor (game, base, resources) {
    super('day', game)

    const initiative = []

    this.actions = {
      move: (player, target) => {
        const location = base[target]

        if (location === undefined) throw error.BAD_REQUEST

        initiative.push(player)
        player.location = location

        if (initiative.length === game.players.length) {
          game.state = new Night(game, base, resources, initiative)
        }

        game.push(player.id)
        return { state: game.state.view(player) }
      }
    }

    game.players.forEach(player => {
      player.location = null
      player.canAct = true
    })
  }

  getActions (player) {
    return this.actions
  }
}

class Night extends AbstractPhase {
  constructor (game) {
    super('night', game)
  }

  getActions (player) {
    return {}
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
    _.zipWith(this.game.players, _.shuffle(this.roster), (player, job) => {
      player.job = job
    })

    const base = locations.createBase()
    const resources = {
      energy: 100,
      food: 5,
      medicines: 3
    }

    this.game.state = new Day(this.game, base, resources)
    this.game.push()
  }

  isFull () {
    return this.game.players.length === this.roster.length
  }
}

class Game extends EventEmitter {
  constructor (roster) {
    super()

    roster = _.map(roster, jobID => {
      const Job = jobs[jobID]
      if (Job === undefined) throw error.BAD_REQUEST
      return new Job()
    })

    this.state = new Lobby(this, roster)
    this.players = []
  }

  join (playerID, playerName, session) {
    return this.state.join(playerID, playerName, session)
  }

  leave (playerID) {
    return this.state.leave(playerID)
  }

  execute (playerID, action, target) {
    const player = _.find(this.players, { id: playerID })
    return this.state.execute(player, action, target)
  }

  close () {
    this.push('kick')
    this.emit('close')
  }

  push (playerID) {
    this.players.forEach(player => {
      if (player.id !== playerID) player.push('state', this.state.view(player))
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
