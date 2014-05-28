// dialects/http.js
// Provide service endpoints for pushing to services in qb

// builtin
var url = require('url')
  , net = require('net')
  , fs = require('fs');

// vendor
var _ = require('underscore'),
  express = require('express'),
  request = require('request'),
  async = require('async');

module.exports = {
  name: 'http',
  type: 'rpc',
  startup: startup,
}

function HttpDialect(qb, options) {
  this.qb = qb;
  this.options = options;
  this.auth = options.auth;
  this.retry = options.retry === undefined ? 0 : options.retry * 1;
  this.types = {};
  this.app = options.pushonly ? null : create_app(qb, options, this.types);
  this.ended = false;

  if (!options.pushonly && !options.app && (options.port || options.unix)) {
    qb.log.info('Starting http qb api server at %s %s', options.port ? ':' + options.port : 'unix://' + options.unix, options.base||'')
    if (options.port) {
      this.server = this.app.listen(options.port)
    } else {
      this.server = connectToUnixSocket(qb, this.app, options.unix)
    }
  } else if (!options.pushonly) {
    qb.log.info('http qb api server not started but ready to go at %s', options.base||'')
  } else {
    qb.log.info('Using qb-http as push only')
  }
}

HttpDialect.prototype.can = function() {
  var newtypes = Array.prototype.slice.call(arguments),
    types = this.types;

  _.each(newtypes, function (type) {
    types[type] = true;
  });
}

HttpDialect.prototype.push = function (endpoint, type, task, callback) {
  if (this.ended)
    return callback(new Error('qb ended'))
  make_request(endpoint, type, task, this.retry, callback);
}

HttpDialect.prototype.end = function (cb) {
  this.ended = true;
  if (this.server) {
    this.server.close(cb)
  }
  else
    cb();
}

function startup(qb, options) {
  return new HttpDialect(qb, options);
}

function create_app(qb, options, types) {
  var base = options.base || '',
    app = options.app || express()
      .use(logger(qb))
      .use(express.query())
      .use(express.json())
      .use(express.urlencoded()),
    hasApp = Boolean(options.app);


  if (options.auth) {
    qb.log.info('Using basic auth in http.')
    app.use(base, express.basicAuth(options.auth.user, options.auth.pass));
  }

  app
    .use(base + '/test', testEndpoint)
    .use(base, getTypeCallback(base, types))
    .use(base, pushEndpoint(qb, options.onaction || defaultOnAction));

  if (options.allow_defer) {
    app.use(base, deleteEndpoint(qb, options.onaction || defaultOnAction));
  }

  if (!options.dont_use_404_catch) {
    app.use(base, error404);
  }

  return app
}

function make_request(endpoint, type, task, nretries, callback) {
  // Here's a good way to do
  request({
    method: 'POST',
    uri: endpoint + '/' + type,
    json: task
  }, function (err, resp) {
    if (err && nretries > 0) {
      return make_request(endpoint, type, task, nretries - 1, callback);
    } else if (!resp || resp.statusCode !== 200) {
      err = new Error(JSON.stringify(resp ? resp.body : 'no response from ' + endpoint + '/' + type));
    }
    callback(err, resp);
  });
}

function verifyBaseUrl(base) {
  return function (req, res, next) {
    // Set the base url
    if (req.path.slice(0, base.length) === base) {
      return next();
    }
    res.jsonp(404, {error: 'all routes begin with ' + base});
  }
}

// Figures out if this is an available path
function getTypeCallback(base, types) {

  return function (req, res, next) {
    var regex = new RegExp('^/(' + Object.keys(types).join('|') + ')(?:/(.*))?$')

    var m = req.url.match(regex)
      , type = m && m[1]

    if (!type) {
      return res.jsonp(404, {error: 'url not understood'})
    } else if (!types[type]) {
      return res.jsonp(404, {error: 'this service cannot perform tasks of type ' + type});
    }

    req.type = type
    req.rest = m && m[2]
    next()
  }
}

function pushEndpoint(qb, onaction) {
  return function (req, res, next) {
    if (req.method !== 'POST') {
      return next()
    }

    var type = req.type
      , body = _.isArray(req.body) ? req.body : [req.body];

    async.each(_.values(body), function (task, cb) {
      qb.push(type, task, cb)
    }, onaction.bind(null, req, res))
  }

}

function deleteEndpoint(qb, onerror) {
  return function (req, res, next) {
    if (req.method !== 'DELETE') {
      return next()
    }

    var type = req.type
      , id = req.rest;

    qb.undefer_remove(queue, id, onaction.bind(null, req, res));
  }
}

function testEndpoint(req, res) {
  res.jsonp(200)
}

function error404(req, res) {
  res.jsonp(404, {error: 'not found'})
}

function defaultOnAction(req, res, err) {
  if (err) {
    res.jsonp(500, {error: err.message, stack: err.stack});
  } else {
    res.jsonp({ok:true, type: req.type});
  }
}

function logger(qb) {
  return function (req, res, next) {
    req._startTime = new Date()
    var url = req.url
    var end = res.end
    res.end = function () {
      res.end = end
      res.end.apply(res, arguments)

      log()
    }

    function log() {
      out = []
      out.push('[' + new Date().toString() + ']')
      out.push(res.statusCode)
      out.push(req.method.toUpperCase())
      out.push(url)
      out.push('(' + (new Date() - req._startTime))
      out.push('ms)')
      qb.log.debug(out.join(' '))
    }
    next()
  }
}

function connectToUnixSocket(qb, app, path) {
  var server = app.listen(path)

  server.on('error', function (e) {
    if (e.code == 'EADDRINUSE') {
      // If we get addrinuse for a unix socket, we can try and connect to the socket
      // If we can connect, another service has taken our socket!
      // Otherwise, we can delete and re-listen
      var clientSocket = new net.Socket();
      clientSocket.on('error', function(e) { // handle error trying to talk to server
        if (e.code == 'ECONNREFUSED') {  // No other server listening
          fs.unlink(path, function (err) {
            if (err) {
              return qb.emit('error', err)
            }
            server.listen(path);
          });
        }
      });
      clientSocket.connect({path: path}, function() {
        qb.log.panic('Another server is running at unix socket location %s', path)
        setTimeout(process.exit, 500);
      });
    } else {
      qb.emit('error', e)
    }
  });

  server.on('listening', function (err) {
    if (err) {
      qb.emit('error', err)
    } else {
      fs.chmod(path, 0777, function (err) {
        if (err) {
          qb.emit('error', err)
        } else {
          qb.log.info('Unix socket opened and set to 777.')
        }
      })
    }
  })

  return server;
}
