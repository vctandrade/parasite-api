
function create (code, message) {
  return { code, message }
}

module.exports = {
  INTERNAL: create(1, 'Internal error'),
  UNAUTHORIZED: create(2, 'Client unauthorized'),
  BAD_REQUEST: create(3, 'Request invalid'),

  GAME_FULL: create(4, 'Game full'),
  NOT_IN_GAME: create(7, 'Client hasn\'t joined any game yet'),

  MULTIPLE_LOGINS: create(6, 'Already logged in')
}
