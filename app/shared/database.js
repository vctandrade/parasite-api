const Sequelize = require('sequelize')

module.exports = class Database {
  constructor (sequelize) {
    this.Player = sequelize.define('player', {
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
  }
}
