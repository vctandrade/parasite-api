
let counter = 0

function error (message) {
  return { code: counter++, message }
}

module.exports = {
  INTERNAL_ERROR: error('Internal Error'),
  UNAUTHORIZED: error('Client Unauthorized'),
  BAD_REQUEST: error('Request Invalid')
}
