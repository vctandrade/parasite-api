const _ = require('lodash')

const error = require('../shared/error')
const jobs = require('../shared/jobs')
const locations = require('../shared/locations')
const shortid = require('shortid')

const EventEmitter = require('events')

class Player {
  constructor (id, nickname, session) {
    this.id = id
    this.nickname = nickname
    this.session = session

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
    return this.nickname
  }
}

class Morning {
  constructor (game, base, resources) {
    this.game = game
    this.base = base
    this.resources = resources

    this.actions = {
      move: (player, params) => {
        const location = this.base[params.location]

        if (location === undefined) throw error.BAD_REQUEST

        player.location = location
        this.game.push(player.id)

        return { state: this.view(player) }
      }
    }

    game.players.forEach(player => {
      player.location = base.dormitory
    })
  }

  view (player) {
    return {
      name: 'morning',
      info: {
        resources: {
          shared: this.resources,
          individual: player.resources
        },
        location: player.location,
        players: _.filter(this.game.players, other => other.location === player.location),
        job: player.job
      }
    }
  }

  join (playerID, nickname, session) {
    const player = _.find(this.game.players, { id: playerID })

    if (player === undefined) throw error.GAME_FULL

    player.session = session

    return { state: this.view(player) }
  }

  leave (playerID) {
    const player = _.find(this.game.players, { id: playerID })
    player.session = null
  }
}

class Lobby {
  constructor (game, roster) {
    this.game = game
    this.roster = roster

    this.startTime = null
    this.timer = null

    this.actions = {}
  }

  view (player) {
    return {
      name: 'lobby',
      info: {
        players: this.game.players,
        startTime: this.startTime
      }
    }
  }

  join (playerID, nickname, session) {
    if (this.isFull()) throw error.GAME_FULL

    const player = new Player(playerID, nickname, session)
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

    this.game.state = new Morning(this.game, base, resources)
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

  join (playerID, nickname, session) {
    return this.state.join(playerID, nickname, session)
  }

  leave (playerID) {
    return this.state.leave(playerID)
  }

  execute (playerID, action, params) {
    const player = _.find(this.players, { id: playerID })
    const method = this.state.actions[action]

    if (method === undefined) throw error.BAD_REQUEST

    return method(player, params)
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
  constructor (discovery, redis, koa) {
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
    const { playerID, nickname, gameID } = args

    const game = this.games.get(gameID)
    session.ws.once('close', () => game.leave(playerID))

    return game.join(playerID, nickname, session)
  }

  async leaveGame (session, args) {
    const { playerID, gameID } = args

    const game = this.games.get(gameID)
    return game.leave(playerID)
  }

  async execute (session, args) {
    const { playerID, gameID, action, params } = args

    const game = this.games.get(gameID)
    return game.execute(playerID, action, params)
  }
}
