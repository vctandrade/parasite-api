const Sequelize = require('sequelize')

module.exports = {
  init: async function (sequelize) {
    const Player = sequelize.define('player', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          notEmpty: true
        }
      }
    })

    await sequelize.sync()
    return { Player }
  }
}
