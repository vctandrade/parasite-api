
function build (code, message) {
  return { code, message }
}

module.exports = {
  INTERNAL_ERROR: build(1, 'Internal error'),
  UNAUTHORIZED: build(2, 'Client unauthorized'),
  BAD_REQUEST: build(3, 'Request invalid'),

  ROOM_FULL: build(4, 'Room full'),
  MULTIPLE_JOINS: build(5, 'Already in a room'),
  MULTIPLE_LOGINS: build(6, 'Already logged in')
}
