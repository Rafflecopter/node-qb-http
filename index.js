// dialects/http.js
// Provide service endpoints for pushing to services in qb

// builtin
var url = require('url');

// vendor
var _ = require('underscore'),
  express = require('express'),
  request = require('request');

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
  this.app = create_app(qb, options, this.types);
  this.ended = false;

  if (!options.app && options.port) {
    qb.log.info('Starting http qb api server at :%d%s', options.port, options.base||'')
    this.server = this.app.listen(options.port)
  } else {
    qb.log.info('http qb api server not started but ready to go at %s', options.base||'')
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
  make_request(endpoint, type, task, this.retry, this.auth, callback);
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
    .use(base, pushEndpoint(qb));

  if (qb._options.allow_defer) {
    app.use(base, deleteEndpoint(qb));
  }

  app.use(base, error404);

  return app
}

function make_request(endpoint, type, task, nretries, auth, callback) {
  // Here's a good way to do
  request({
    method: 'POST',
    uri: endpoint + '/' + type,
    json: task,
    auth: auth
  }, function (err, resp) {
    if (err && nretries > 0) {
      return make_request(endpoint, type, task, nretries - 1, callback);
    } else if (!resp || resp.statusCode !== 200) {
      err = new Error(JSON.stringify(resp ? resp.body : 'no response'));
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
    res.send(404, {error: 'all routes begin with ' + base});
  }
}

// Figures out if this is an available path
function getTypeCallback(base, types) {

  return function (req, res, next) {
    var regex = new RegExp('^/(' + Object.keys(types).join('|') + ')(?:/(.*))?')

    var m = req.url.match(regex)
      , type = m && m[1]

    if (!type) {
      return res.send(404, {error: 'url not understood'})
    } else if (!types[type]) {
      return res.send(404, {error: 'this service cannot perform tasks of type ' + type});
    }

    req.type = type
    req.rest = m && m[2]
    next()
  }
}

function pushEndpoint(qb) {
  return function (req, res, next) {
    if (req.method !== 'POST') {
      return next()
    }

    var type = req.type
      , body = _.isArray(req.body) ? req.body : [req.body];

    _.each(body, function (task) {
      qb.push(type, task, function (err) {
        if (err) {
          res.send(500, {error: err.message, stack: err.stack});
        } else {
          res.send({ok:true, type:type});
        }
      });
    })
  }
}

function deleteEndpoint(qb) {
  return function (req, res, next) {
    if (req.method !== 'DELETE') {
      return next()
    }

    var type = req.type
      , id = req.rest;

    qb.queue(type).undefer_remove(id, function (err) {
      if (err) {
        res.send(500, {error: err.message, stack: err.stack});
      } else {
        res.send({ok:true, type:type});
      }
    });
  }
}

function testEndpoint(req, res) {
  res.send(200)
}

function error404(req, res) {
  res.send(404, {error: 'not found'})
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