const _ = require('lodash')

const error = require('../shared/error')

module.exports = {
  // Common actions

  'nothing': function (game, player, target) {
  },

  // Location actions

  'sleep': function (game, player, target) {
    if (
      player.location.name !== 'dormitory'

    ) throw error.BAD_REQUEST

    player.resources.stamina = Math.min(player.resources.stamina + 5, 10)
  },

  'fix-generator': function (game, player, target) {
    if (
      player.location.name !== 'generator' ||
      player.resources.stamina < 3

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 3

    game.resources.generator = Math.min(game.resources.generator + 2, 10)
  },

  'first-aid': function (game, player, target) {
    if (
      player.location.name !== 'infirmary' ||
      game.resources.remedy < 1

    ) throw error.BAD_REQUEST

    game.resources.remedy -= 1

    player.resources.health = Math.min(player.resources.health + 4, 10)
  },

  'cook': function (game, player, target) {
    if (
      player.location.name !== 'kitchen' ||
      player.resources.stamina < 2 ||
      game.resources.energy < 3

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 2
    game.resources.energy -= 3

    game.resources.food += 4
  },

  'eat': function (game, player, target) {
    if (
      player.location.name !== 'kitchen' ||
      game.resources.food < 1

    ) throw error.BAD_REQUEST

    game.resources.food -= 1

    player.resources.hunger = Math.min(player.resources.hunger + 3, 10)
  },

  'research': function (game, player, target) {
    if (
      player.location.name !== 'laboratory' ||
      player.resources.stamina < 7 ||
      game.resources.energy < 5

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 7
    game.resources.energy -= 5

    game.resources.remedy += 2
  },

  // Job actions

  'banquet': function (game, player, target) {
    if (
      player.job !== 'cook' ||
      player.location.name !== 'kitchen' ||
      player.resources.stamina < 6 ||
      game.resources.energy < 8

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 6
    game.resources.energy -= 8

    game.players.forEach(other => {
      if (other.location !== player.location) return
      if (other.state === 'dead') return

      other.resources.hunger = Math.min(other.resources.hunger + 4, 10)
    })
  },

  'overclock': function (game, player, target) {
    if (
      player.job !== 'electricist' ||
      player.location.name !== 'generator' ||
      player.resources.stamina < 5

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 5

    game.resources.energy = Math.min(game.resources.energy + game.resources.generator, 100)
  },

  'tase': function (game, player, target) {
    const other = _.find(game.players, { id: target })

    if (
      player.job !== 'guard' ||
      player.resources.stamina < 1 ||
      game.resources.energy < 5 ||
      other === undefined ||
      other.state !== 'dead'

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 1
    game.resources.energy -= 5

    other.resources.stamina = Math.max(other.resources.stamina - 4, 0)
    other.damage(6)
  },

  'cleanup': function (game, player, target) {
    const other = _.find(game.players, { id: target })

    if (
      player.job !== 'janitor' ||
      player.resources.stamina < 4 ||
      other === undefined ||
      other.state !== 'dead'

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 4

    other.location = 'morgue'
  },

  'pep-talk': function (game, player, target) {
    if (
      player.job !== 'manager' ||
      player.resources.stamina < 6

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 6

    game.players.forEach(other => {
      if (other.id === player.id) return
      if (other.location !== player.location) return
      if (other.state === 'dead') return

      other.resources.stamina = Math.min(other.resources.health + 4, 10)
    })
  },

  'trap': function (game, player, target) {
    if (
      player.job !== 'mechanic' ||
      player.resources.stamina < 4 ||
      game.resources.energy < 12

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 4
    game.resources.energy -= 12

    game.players.forEach(other => {
      if (other.id === player.id) return
      if (other.location !== player.location) return
      if (other.state === 'dead') return

      other.damage(4)
    })
  },

  'vaccination': function (game, player, target) {
    if (
      player.job !== 'medic' ||
      player.location.name !== 'infirmary' ||
      player.resources.stamina < 4 ||
      game.resources.remedy < 3

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 4
    game.resources.remedy -= 3

    game.players.forEach(other => {
      if (other.id === player.id) return
      if (other.location !== player.location) return
      if (other.state === 'dead') return

      other.resources.health = Math.min(other.resources.health + 6, 10)
    })
  },

  'reanimate': function (game, player, target) {
    const other = _.find(game.players, { id: target })

    if (
      player.job !== 'scientist' ||
      player.resources.stamina < 2 ||
      game.resources.energy < 15 ||
      other === undefined ||
      other.state !== 'dead'

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 2
    game.resources.energy -= 15

    other.resources.health = 2
    other.state = 'busy'
  }
}
