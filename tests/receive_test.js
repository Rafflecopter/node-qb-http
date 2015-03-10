
var request = require('request')
  , async = require('async')
  , express = require('express')
  , bodyParser = require('body-parser')
  , extend = require('xtend')
  , QB = require('qb')
  , qbHttp = require('..')
  , qb, url

var tests = exports.tests = {}

var baseOptions = {
  app: undefined
, no_middleware: undefined
, port: undefined
, unix: undefined
, base: ''
, auth: undefined
, dont_use_404_catch: false
, reply: undefined
}

process.setMaxListeners(200)

tests.setUp = function (cb) {
  qb = new QB()
  baseOptions.port = Math.floor(Math.random() * 1000) + 15000
  url = 'http://localhost:' + baseOptions.port
  cb()
}

tests.tearDown = function (cb) {
  qb.end()
  cb()
}

tests.nil = function (test) {
  test.expect(0)
  qb.on('error', test.done)
    .component(qbHttp.receive, baseOptions)
    .on('http-ready', function () { test.done() })
}

tests.test_endpoint = function (test) {
  test.expect(3)
  qb.on('error', test.done)
    .component(qbHttp.receive, baseOptions)
    .on('http-ready', function () {
      request({url: url + '/test', method: 'GET', json: true}, function (err, res, body) {
        test.ifError(err)
        test.equal(res.statusCode, 200)
        test.equal(body.ok, true)
        test.done()
      })
    })
}

tests.type_not_found = function (test) {
  test.expect(3)
  qb.on('error', test.done)
    .component(qbHttp.receive, baseOptions)
    .on('http-ready', function () {
      request({url: url + '/foobar', method: 'POST', json: {obj:'ect'}}, function (err, res, body) {
        test.ifError(err)
        test.equal(res.statusCode, 404)
        test.equal(body.error, 'this service cannot perform tasks of type foobar')
        test.done()
      })
    })
}

tests.notfound_catchall_endpoint = function (test) {
  test.expect(3)
  qb.on('error', test.done)
    .component(qbHttp.receive, baseOptions)
    .on('http-ready', function () {
      request({url: url + '/', method: 'GET', json: true}, function (err, res, body) {
        test.ifError(err)
        test.equal(res.statusCode, 404)
        test.equal(body.error, 'not found')
        test.done()
      })
    })
}

tests.receive_task = function (test) {
  test.expect(5)
  qb.on('error', test.done)
    .component(qbHttp.receive, baseOptions)
    .on('http-ready', function () {
      request({url:url + '/number', method: 'POST', json: {number: 5}}, function (err, res, body) {
        test.ifError(err)
        test.equal(res.statusCode, 200)
        test.equal(body.ok, true)
        setImmediate(test.done)
      })
    })
    .can('number', function (task, done) {
      test.ifError(new Error('no queue would call this'))
      done()
    })
    .on('push', function (type, task) {
      test.equal(type, 'number')
      test.equal(task.number, 5)
    })
}

tests.receive_failure = function (test) {
  test.expect(5)
  qb.on('error', test.done)
    .component(qbHttp.receive, baseOptions)
    .on('http-ready', function () {
      request({url:url + '/failman', method: 'POST', json: {should: 'fail'}}, function (err, res, body) {
        test.ifError(err)
        test.equal(res.statusCode, 500)
        test.equal(body.error, 'my bad')
        setImmediate(test.done)
      })
    })
    .can('failman', function (task, done) {
      test.ifError(new Error('no queue would call this'))
      done()
    })
    .on('push', function (type, task, next) {
      test.equal(type, 'failman')
      test.equal(task.should, 'fail')
      next(new Error('my bad'))
    })
}

tests.provided_app_listen = function (test) {
  test.expect(4)
  var app = express()
    .use(function (req, res, next) {
      test.equal(req.url, '/test')
      next()
    })
  qb.on('error', test.done)
    .component(qbHttp.receive, extend(baseOptions, {app:app}))
    .on('http-ready', function () {
      request({url: url + '/test', method: 'GET', json: true}, function (err, res, body) {
        test.ifError(err)
        test.equal(res.statusCode, 200)
        test.equal(body.ok, true)
        test.done()
      })
    })
}

tests.no_listen = function (test) {
  test.expect(1)
  var app = express()
    .use(function (req, res, next) {
      test.equal(req.url, '/test')
      next()
    })
  qb.on('error', test.done)
    .on('http-ready', function () {
      request({url: url + '/test', method: 'GET', json: true}, function (err, res, body) {
        test.ok(err)
        test.done()
      })
    })
    .component(qbHttp.receive, extend(baseOptions, {app:app, port:undefined}))
}

tests.no_middleware = function (test) {
  test.expect(7)
  var app = express()
    .use(require('body-parser').json())
    .use(function (req, res, next) {
      test.equal(req.url, '/texmex')
      test.equal(req.body.tacos, 'tacos')
      req.body = {tacos: 'burritos'}
      next()
    })
  qb.on('error', test.done)
    .component(qbHttp.receive, extend(baseOptions, {app:app, no_middleware: true}))
    .on('http-ready', function () {
      request({url: url + '/texmex', method: 'POST', json: {tacos:'tacos'}}, function (err, res, body) {
        test.ifError(err)
        test.equal(res.statusCode, 200)
        test.equal(body.ok, true)
        setImmediate(test.done)
      })
    })
    .can('texmex', function (task, done) {
      test.ifError(new Error('no queue so this shouldnt be called')); done()
    })
    .on('push', function (type, task) {
      test.equal(type, 'texmex')
      test.equal(task.tacos, 'burritos')
    })
}

tests.unix_socket = function (test) {
  test.expect(3)
  qb.on('error', test.done)
    .component(qbHttp.receive, extend(baseOptions, {port: undefined, unix: '/tmp/test.sock'}))
    .on('http-ready', function () {
      request({url: 'http://unix:/tmp/test.sock:/test', method: 'GET', json: true}, function (err, res, body) {
        test.ifError(err)
        test.equal(res.statusCode, 200)
        test.equal(body.ok, true)
        test.done()
      })
    })
}

tests.base_url = function (test) {
  test.expect(6)
  qb.on('error', test.done)
    .component(qbHttp.receive, extend(baseOptions, {base: '/YOYO'}))
    .on('http-ready', function () {
      async.parallel([
        function (cb) {
          request({url: url+'/test', method: 'GET', json: true}, function (err, res, body) {
            test.ifError(err)
            test.equal(res.statusCode, 404)
            test.equal(body, 'Cannot GET /test\n')
            cb()
          })
        },
        function (cb) {
          request({url: url+'/YOYO/test', method: 'GET', json: true}, function (err, res, body) {
            test.ifError(err)
            test.equal(res.statusCode, 200)
            test.equal(body.ok, true)
            cb()
          })
        }
      ], test.done)
    })
}

tests.basic_auth = function (test) {
  test.expect(6)
  qb.on('error', test.done)
    .component(qbHttp.receive, extend(baseOptions, {auth: {user:'foo',pass:'bar'}}))
    .on('http-ready', function () {
      async.parallel([
        function (cb) {
          request({url: url+'/test', method: 'GET', json: true}, function (err, res, body) {
            test.ifError(err)
            test.equal(res.statusCode, 401)
            test.equal(body, 'Unauthorized')
            cb()
          })
        },
        function (cb) {
          request({url: url+'/test', method: 'GET', json: true, auth: {user:'foo',pass:'bar'}}, function (err, res, body) {
            test.ifError(err)
            test.equal(res.statusCode, 200)
            test.equal(body.ok, true)
            cb()
          })
        }
      ], test.done)
    })
}

tests.no_404_catch = function (test) {
  test.expect(3)
  qb.on('error', test.done)
    .component(qbHttp.receive, extend(baseOptions, {no_404_catch: true}))
    .on('http-ready', function () {
      request({url: url + '/', method: 'GET', json: true}, function (err, res, body) {
        test.ifError(err)
        test.equal(res.statusCode, 404)
        test.equal(body, 'Cannot GET /\n')
        test.done()
      })
    })
}

tests.custom_reply = function (test) {
  test.expect(7)
  qb.on('error', test.done)
    .component(qbHttp.receive, extend(baseOptions, {reply: reply}))
    .on('http-ready', function () {
      request({url:url + '/custreply', method: 'POST', json: {zing: 'zong'}}, function (err, res, body) {
        test.ifError(err)
        test.equal(res.statusCode, 212)
        test.equal(body.awesome, 'everything')
        setImmediate(test.done)
      })
    })
    .can('custreply', function (task, done) {
      test.ifError(new Error('no queue would call this'))
      done()
    })
    .on('push', function (type, task, next) {
      test.equal(type, 'custreply')
      test.equal(task.zing, 'zong')
      next(new Error('im not a bill'))
    })

  function reply(req, res, err) {
    test.equal(err && err.message, 'im not a bill')
    test.equal(req.params.type, 'custreply')
    res.status(212).jsonp({awesome: 'everything'})
  }
}

tests.delete_endpoint = function (test) {
  test.expect(5)
  qb._relyq = {options: {allow_defer: true}}
  qb.undefer_remove = function (type, id, callback) {
    test.equal(type, 'yoyos')
    test.equal(id, '123abc')
    callback()
  }
  qb.on('error', test.done)
    .component(qbHttp.receive, baseOptions)
    .on('http-ready', function () {
      request({url:url + '/yoyos/123abc', method: 'DELETE', json: true}, function (err, res, body) {
        test.ifError(err)
        test.equal(res.statusCode, 200)
        test.equal(body.ok, true)
        setImmediate(test.done)
      })
    })
    .can('yoyos', function (task, done) {
      test.ifError(new Error('no queue would call this'))
      done()
    })
}
