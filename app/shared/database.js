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
      },
      packs: {
        type: Sequelize.STRING,
        defaultValue: '[]',
        get: function () {
          const string = this.getDataValue('packs')
          return JSON.parse(string)
        },
        set: function (value) {
          const string = JSON.stringify(value)
          return this.setDataValue('packs', string)
        }
      }
    })
  }
}
