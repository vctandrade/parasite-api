
let counter = 0

function error (message) {
  return { code: counter++, message }
}

module.exports = {
  INTERNAL_ERROR: error('Internal error'),
  UNAUTHORIZED: error('Client unauthorized'),
  BAD_REQUEST: error('Request invalid'),

  ROOM_FULL: error('Room full'),
  MULTIPLE_JOINS: error('Already in a room'),
  MULTIPLE_LOGINS: error('Already logged in')
}
