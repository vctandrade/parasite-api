
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
  'generator',
  'infirmary',
  'kitchen',
  'laboratory'
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
