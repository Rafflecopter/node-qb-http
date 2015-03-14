// qb-http/index.js
// A QB Component to provide push of requests via http

var receive = require('./lib/receive')
  , push = require('./lib/push')

// Setup either an receive or push http interface
module.exports.receive = receive
module.exports.push = push

module.exports.logger = require('./lib/receive/logger-middleware')