const Sequelize = require('sequelize')

module.exports = {
  create: function (sequelize) {
    const Player = sequelize.define('player', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          notEmpty: true
        }
      },
      token: {
        type: Sequelize.UUID,
        unique: true
      }
    })

    return { Player }
  }
}
