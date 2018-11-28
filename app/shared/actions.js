const _ = require('lodash')

const error = require('../shared/error')

module.exports = {
  // Common actions

  'nothing': function (game, player, target) {
  },

  'punch': function (game, player, target) {
    const other = _.find(game.players, { id: target })

    if (
      player.resources.stamina.value < 2 ||
      other === undefined ||
      other === player ||
      other.state === 'dead' ||
      other.location !== player.location

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-2)
    other.resources.health.update(-2)
  },

  'hide': function (game, player, target) {
    player.hidden = true
  },

  // Location actions

  'sleep': function (game, player, target) {
    if (
      player.location.name !== 'dormitory'

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(+5)
  },

  'fix-generator': function (game, player, target) {
    if (
      player.location.name !== 'generator' ||
      player.resources.stamina.value < 3

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-3)
    game.resources.generator.update(+2)
  },

  'first-aid': function (game, player, target) {
    if (
      player.location.name !== 'infirmary' ||
      game.resources.remedy.value < 1

    ) throw error.BAD_REQUEST

    game.resources.remedy.update(-1)
    player.resources.health.update(+4)
  },

  'cook': function (game, player, target) {
    if (
      player.location.name !== 'kitchen' ||
      player.resources.stamina.value < 2 ||
      game.resources.energy.value < 3

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-2)
    game.resources.energy.update(-3)
    game.resources.food.update(+4)
  },

  'eat': function (game, player, target) {
    if (
      player.location.name !== 'kitchen' ||
      game.resources.food.value < 1

    ) throw error.BAD_REQUEST

    game.resources.food.update(-1)
    player.resources.hunger.update(+3)
  },

  'research': function (game, player, target) {
    if (
      player.location.name !== 'laboratory' ||
      player.resources.stamina.value < 7 ||
      game.resources.energy.value < 5

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-7)
    game.resources.energy.update(-5)

    game.resources.remedy.update(+2)
  },

  // Job actions

  'banquet': function (game, player, target) {
    if (
      player.job !== 'cook' ||
      player.location.name !== 'kitchen' ||
      player.resources.stamina.value < 6 ||
      game.resources.energy.value < 8

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-6)
    game.resources.energy.update(-8)

    game.players.forEach(other => {
      if (other.location !== player.location) return
      if (other.state === 'dead') return

      other.resources.hunger.update(+4)
    })
  },

  'overclock': function (game, player, target) {
    if (
      player.job !== 'electricist' ||
      player.location.name !== 'generator' ||
      player.resources.stamina.value < 5

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-5)
    game.resources.energy.update(game.resources.generator.value)
  },

  'tase': function (game, player, target) {
    const other = _.find(game.players, { id: target })

    if (
      player.job !== 'guard' ||
      player.resources.stamina.value < 1 ||
      game.resources.energy.value < 5 ||
      other === undefined ||
      other === player ||
      other.state === 'dead' ||
      other.location !== player.location

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-1)
    game.resources.energy.update(-5)

    other.resources.stamina.update(-4)
    other.resources.health.update(-6)
  },

  'cleanup': function (game, player, target) {
    const other = _.find(game.players, { id: target })

    if (
      player.job !== 'janitor' ||
      player.resources.stamina.value < 4 ||
      other === undefined ||
      other.state !== 'dead' ||
      other.location !== player.location

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-4)

    other.location = 'morgue'
  },

  'pep-talk': function (game, player, target) {
    if (
      player.job !== 'manager' ||
      player.resources.stamina.value < 6

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-6)

    game.players.forEach(other => {
      if (other === player) return
      if (other.location !== player.location) return
      if (other.state === 'dead') return

      other.resources.stamina.update(+4)
    })
  },

  'trap': function (game, player, target) {
    if (
      player.job !== 'mechanic' ||
      player.resources.stamina.value < 4 ||
      game.resources.energy.value < 12

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-4)
    game.resources.energy.update(-12)

    game.players.forEach(other => {
      if (other === player) return
      if (other.location !== player.location) return
      if (other.state === 'dead') return

      other.resources.health.update(-4)
    })
  },

  'vaccination': function (game, player, target) {
    if (
      player.job !== 'medic' ||
      player.location.name !== 'infirmary' ||
      player.resources.stamina.value < 4 ||
      game.resources.remedy.value < 3

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-4)
    game.resources.remedy.update(-3)

    game.players.forEach(other => {
      if (other === player) return
      if (other.location !== player.location) return
      if (other.state === 'dead') return

      other.resources.health.update(+6)
    })
  },

  'reanimate': function (game, player, target) {
    const other = _.find(game.players, { id: target })

    if (
      player.job !== 'scientist' ||
      player.resources.stamina.value < 2 ||
      game.resources.energy.value < 15 ||
      other === undefined ||
      other.state !== 'dead'

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-2)
    game.resources.energy.update(-15)

    other.resources.health.update(+2)
    other.state = 'busy'
  }
}
