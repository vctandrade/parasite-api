
function build (code, message) {
  return { code, message }
}

module.exports = {
  INTERNAL: build(1, 'Internal error'),
  UNAUTHORIZED: build(2, 'Client unauthorized'),
  BAD_REQUEST: build(3, 'Request invalid'),

  GAME_FULL: build(4, 'Game full'),
  MULTIPLE_JOINS: build(5, 'Already in a game'),
  MULTIPLE_LOGINS: build(6, 'Already logged in')
}
