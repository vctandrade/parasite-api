
class Dormitory {
  toJSON () {
    return 'dormitory'
  }
}

class Kitchen {
  toJSON () {
    return 'kitchen'
  }
}

module.exports = {
  createBase: function () {
    return {
      dormitory: new Dormitory(),
      kitchen: new Kitchen()
    }
  }
}
