// qb-http/lib/outgoing.js
// An outgoing http interface for qb tasks
// Will send http requests to other qb-http servers on `qb.push('http://...', obj)`

// Use with `qb.component(require('qb-http').outgoing, httpOutgoingOptions)`
// Options:
// - retry: number of retries before a no response failure (default 0)

// vendor
var request = require('request')

module.exports = attachComponent

function attachComponent(qb, options) {
  var retry = (typeof (options && options.retry) === 'number') ? options.retry : 0

  qb.on('push', function (location, task, next) {
    if (/^https?:\/\//.test(location)) {
      makeRequest(location, task, retry, next)
    }
  })
}

function makeRequest(uri, task, nretries, callback) {
  request({
    method: 'POST',
    uri: uri,
    json: task
  }, function (err, resp) {
    if (!err && (!resp || resp.statusCode !== 200))
      err = new Error(JSON.stringify(resp ? resp.body : 'no response from ' + uri))

    if (err && nretries > 0)
      return makeRequest(uri, task, nretries - 1, callback)

    if (err)
      return callback(err)

    callback(null, resp)
  })
}
