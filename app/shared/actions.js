const error = require('../shared/error')

module.exports = {
  'nothing': function (game, player, target) {
  },

  'banquet': function (game, player, target) {
    if (
      player.location.name !== 'kitchen' ||
      player.job !== 'cook' ||
      player.resources.stamina < 6 ||
      game.resources.energy < 8

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 6
    game.resources.energy -= 8

    game.players.forEach(other => {
      if (other.id === player.id) return
      if (other.location !== player.location) return

      other.resources.stamina = Math.min(other.resources.stamina + 4, 10)
    })
  },

  'vaccination': function (game, player, target) {
    if (
      player.location.name !== 'infirmary' ||
      player.job !== 'medic' ||
      player.resources.stamina < 4 ||
      game.resources.remedy < 3

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 4
    game.resources.remedy -= 3

    game.players.forEach(other => {
      if (other.id === player.id) return
      if (other.location !== player.location) return

      other.resources.health = Math.min(other.resources.health + 6, 10)
    })
  },

  'boost-generator': function (game, player, target) {
    if (
      player.location.name !== 'mechanical-room' ||
      player.job !== 'electricist' ||
      player.resources.stamina < 5

    ) throw error.BAD_REQUEST

    player.resources.stamina -= 5
    game.resources.energy = Math.min(game.resources.energy + 15, 100)
  },

  'sleep': function (game, player, target) {
    if (
      player.location.name !== 'dormitory'

    ) throw error.BAD_REQUEST

    player.resources.hunger -= 2
    player.resources.stamina = Math.min(player.resources.stamina + 5, 10)
  },

  'eat': function (game, player, target) {
    if (
      player.location.name !== 'kitchen' ||
      game.resources.food < 1

    ) throw error.BAD_REQUEST

    game.resources.food -= 1
    player.resources.hunger = Math.min(player.resources.hunger + 3, 10)
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

  'first-aid': function (game, player, target) {
    if (
      player.location.name !== 'infirmary' ||
      game.resources.remedy < 1

    ) throw error.BAD_REQUEST

    game.resources.remedy -= 1
    player.resources.health = Math.min(player.resources.health + 4, 10)
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
  }
}
