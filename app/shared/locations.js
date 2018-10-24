
class Location {
  constructor (name) {
    this.name = name
  }

  toJSON () {
    return this.name
  }
}

const locations = [
  'dormitory',
  'infirmary',
  'kitchen',
  'laboratory',
  'mechanical-room'
]

module.exports = {
  createBase: function () {
    const base = {}

    locations.forEach(name => {
      base[name] = new Location(name)
    })

    return base
  }
}
