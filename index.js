// qb-http/index.js
// A QB Component to provide push of requests via http

var incoming = require('lib/incoming')
  , outgoing = require('lib/outgoing')

// Setup either an incoming or outgoing http interface
module.exports.incoming = incoming
module.exports.outgoing = outgoing