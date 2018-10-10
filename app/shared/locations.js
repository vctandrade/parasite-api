
class Dormitory {
  toJSON () {
    return 'dormitory'
  }
}

module.exports = {
  createBase: function () {
    return {
      dormitory: new Dormitory()
    }
  }
}
