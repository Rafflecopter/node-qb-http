// qb-http/lib/incoming.js
// An incoming http interface for qb tasks
// Starts an http server that, upon receiving tasks, emits a `push` event

// Use with `qb.component(require('qb-http').incoming, httpIncomingOptions)`
// Options:
// - app: provide your own express 4 app.
// - noMiddleware: dont attach middleware (you should attach body parser and logging then)
// - port: listen on a port
// - unix: listen on a unix socket (port must be falsy)
// - base: base api url
// - auth: {user: '', pass: ''} object for basic auth at `base`
// - dont_use_404_catch: if true, no 404 catchall will be put at `base`
// - reply: function (req, res, err) to respond to requests (usually jsonp 500 on error)

// vendor
var express = require('express')
  , bodyParser = require('body-parser')
  , unixListen = require('unix-listen')

// local
var basicAuth = require('./basic-auth-middleware')
  , endpoints = require('./endpoints')
  , logger = require('./logger-middleware')

module.exports = attachComponent

function attachComponent(qb, options) {
  var app = options.app || express()
    , server

  if (!options.noMiddleware)
    attachMiddleware(app, options)

  attachEndpoints(app, qb, options)

  server = listen(app, options)

  // Now listen on qb events
  qb.on('end', function (next) {
    if (server)
      server.close(next)
    else
      next()
  })

  // Allow some outside access
  qb._http = qb._http || {}
  qb._http.app = app
  qb._http.server = server
}

function attachEndpoints(app, qb, options) {
  var base = options.base || ''

  app.get(base + '/test', testEndpoint)
    .use(base + '/:type', endpoints.verifyType(qb))
    .post(base + '/:type', endpoints.push(qb, options.reply))

  if (qb._options.allow_defer)
    app.delete(base + '/:type/:id', endpoints.deleteDefer(qb, options.reply))

  if (!options.dont_use_404_catch)
    app.use(base, errorNotFound)
}

function attachMiddleware(app, options) {
  var base = options.base || ''

  app.use(logger(qb))
    .use(bodyParser.json())
    .use(bodyParser.urlencoded())

  if (options.auth) {
    qb.log.info('Using basic auth in http server.')
    app.use(base, basicAuth(options.auth.user, options.auth.pass))
  }
}

function listen(app, options) {
  if (options.port)
    return app.listen(options.port, callback('listening on ' + options.port))
  if options.unix
    return unixListen(app, options.unix, { mode: '0777' }, callback('listening at ' + options.unix))

  function callback(msg) {
    return function (err) {
      if (err) {
        qb.log.error(err, 'Error starting http server ' + msg)
        setTimeout(process.exit, 500)
      } else {
        qb.log.info('http server started and ' + msg)
      }
    }
  }
}