const _ = require('lodash')

const error = require('../shared/error')
const shortid = require('shortid')

module.exports = {
  // Common actions

  'nothing': function (game, player, target) {
  },

  'punch': function (game, player, target) {
    const other = _.find(game.players, { pid: target })

    if (
      player.resources.stamina.value < 2 ||
      other === undefined ||
      other === player ||
      other.state === 'dead' ||
      other.location !== player.location ||
      other.conditions.hidden

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-2)
    other.resources.health.update(-2)
  },

  'hide': function (game, player, target) {
    player.conditions.hidden = true
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
    player.conditions.sick = false
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
    player.resources.nutrition.update(+5)
  },

  'research': function (game, player, target) {
    if (
      player.location.name !== 'laboratory' ||
      player.resources.stamina.value < 4 ||
      game.resources.energy.value < 7

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-4)
    game.resources.energy.update(-7)

    game.resources.remedy.update(+3)
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
      if (other.conditions.hidden) return

      other.resources.nutrition.update(+7)
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
    const other = _.find(game.players, { pid: target })

    if (
      player.job !== 'guard' ||
      player.resources.stamina.value < 1 ||
      game.resources.energy.value < 5 ||
      other === undefined ||
      other === player ||
      other.state === 'dead' ||
      other.location !== player.location ||
      other.conditions.hidden

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-1)
    game.resources.energy.update(-5)

    other.resources.stamina.update(-4)
    other.resources.health.update(-6)
  },

  'cleanup': function (game, player, target) {
    const other = _.find(game.players, { pid: target })

    if (
      player.job !== 'janitor' ||
      player.resources.stamina.value < 4 ||
      other === undefined ||
      other.state !== 'dead' ||
      other.location !== player.location ||
      other.conditions.hidden

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
      if (other.conditions.hidden) return

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
      if (other.conditions.hidden) return

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
      if (other.conditions.hidden) return

      other.resources.health.update(+6)
      other.conditions.sick = false
    })
  },

  'reanimate': function (game, player, target) {
    const other = _.find(game.players, { pid: target })

    if (
      player.job !== 'scientist' ||
      player.resources.stamina.value < 2 ||
      game.resources.energy.value < 15 ||
      other === undefined ||
      other.state !== 'dead' ||
      other.conditions.hidden

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-2)
    game.resources.energy.update(-15)

    other.resources.health.update(+2)
    other.state = 'busy'
  },

  // Genotype actions

  'mind-games': function (game, player, target) {
    const other = _.find(game.players, { pid: target })

    if (
      player.genotype !== 'swapper' ||
      player.resources.stamina.value < 5 ||
      other === undefined ||
      other === player ||
      other.state === 'dead' ||
      other.location !== player.location ||
      other.conditions.hidden

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-5)

    let buffer

    buffer = player.name
    player.name = other.name
    other.name = buffer

    buffer = player.job
    player.job = other.job
    other.job = buffer
  },

  'sicken': function (game, player, target) {
    const other = _.find(game.players, { pid: target })

    if (
      player.genotype !== 'swapper' ||
      player.resources.stamina.value < 2 ||
      other === undefined ||
      other === player ||
      other.state === 'dead' ||
      other.location !== player.location ||
      other.conditions.hidden

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-2)
    other.conditions.sick = true
  },

  'mesmerise': function (game, player, target) {
    if (
      player.genotype !== 'illusionist'

    ) throw error.BAD_REQUEST

    game.players.forEach(other => {
      if (other === player) return
      if (other.location !== player.location) return
      if (other.state === 'dead') return
      if (other.conditions.hidden) return

      player.resources.stamina.update(other.resources.stamina.update(-2))
    })
  },

  'confuse': function (game, player, target) {
    if (
      player.genotype !== 'illusionist' ||
      player.resources.stamina.value < 4

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-4)

    game.players.forEach(other => {
      if (other === player) return
      if (other.location !== player.location) return
      if (other.state === 'dead') return
      if (other.conditions.hidden) return

      other.conditions.confused = true
    })

    game.players.forEach(other => {
      other.pid = shortid.generate()
    })

    game.players = _.shuffle(game.players)
  },

  'sabotage': function (game, player, target) {
    if (
      player.genotype !== 'brute' ||
      player.location.name !== 'generator' ||
      player.resources.stamina.value < 4

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-4)
    game.resources.generator.update(-4)
  },

  'cannibalize': function (game, player, target) {
    const other = _.find(game.players, { pid: target })

    if (
      player.genotype !== 'brute' ||
      player.resources.stamina.value < 3 ||
      other === undefined ||
      other === player ||
      other.state === 'dead' ||
      other.location !== player.location ||
      other.conditions.hidden

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-3)
    player.resources.nutrition.update(+3)
    other.resources.health.update(-4)
  },

  'feed': function (game, player, target) {
    const other = _.find(game.players, { pid: target })

    if (
      player.genotype !== 'leech' ||
      player.resources.stamina.value < 5 ||
      other === undefined ||
      other === player ||
      other.state === 'dead' ||
      other.location !== player.location ||
      other.conditions.hidden

    ) throw error.BAD_REQUEST

    player.resources.stamina.update(-5)
    player.resources.health.update(other.resources.health.update(-3))
  },

  'transfuse': function (game, player, target) {
    const other = _.find(game.players, { pid: target })

    if (
      player.genotype !== 'leech' ||
      other === undefined ||
      other === player ||
      other.state === 'dead' ||
      other.location !== player.location ||
      other.conditions.hidden

    ) throw error.BAD_REQUEST

    other.resources.health.update(player.resources.health.update(-4))
  }
}
