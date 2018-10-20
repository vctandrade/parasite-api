
class Dormitory {
  toJSON () {
    return 'dormitory'
  }
}

class Infirmary {
  toJSON () {
    return 'infirmary'
  }
}

class Kitchen {
  toJSON () {
    return 'kitchen'
  }
}

class Laboratory {
  toJSON () {
    return 'laboratory'
  }
}

class MechanicalRoom {
  toJSON () {
    return 'mechanicalroom'
  }
}

module.exports = {
  createBase: function () {
    return {
      dormitory: new Dormitory(),
      infirmary: new Infirmary(),
      kitchen: new Kitchen(),
      laboratory: new Laboratory(),
      mechanicalroom: new MechanicalRoom()
    }
  }
}
