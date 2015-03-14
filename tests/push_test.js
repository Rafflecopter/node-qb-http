
var express = require('express')
  , QB = require('qb')
  , qbHttp = require('..')
  , app
  , port
  , server
  , url
  , qb

var tests = exports.tests = {}

var baseOptions = {
  retry: undefined
}

tests.setUp = function (cb) {
  qb = new QB()
  app = express().use(require('body-parser').json())
  port = Math.floor(Math.random() * 1000) + 14000
  server = app.listen(port)
  url = 'http://localhost:' + port
  cb()
}

tests.tearDown = function (cb) {
  qb.end()
  server.close()
  cb()
}

tests.nil = function (test) {
  test.expect(0)
  qb.on('error', test.done)
    .component(qbHttp.push, baseOptions)
  setImmediate(test.done)
}

tests.push_one = function (test) {
  test.expect(4)
  app.post('/:path', function (req, res) {
    test.equal(req.params.path, 'pushtest')
    test.equal(typeof req.body, 'object')
    test.equal(req.body.foo, 'bar')
    res.sendStatus(200)
  })
  qb.on('error', test.done)
    .component(qbHttp.push, baseOptions)
    .push(url + '/pushtest', {foo: 'bar'}, function (err) {
      test.ifError(err)
      setImmediate(test.done)
    })
}

tests.push_alias = function (test) {
  test.expect(4)
  app.post('/:path', function (req, res) {
    test.equal(req.params.path, 'pushtest2')
    test.equal(typeof req.body, 'object')
    test.equal(req.body.foo, 'bar')
    res.sendStatus(200)
  })
  qb.on('error', test.done)
    .component(qbHttp.push, baseOptions)
    .alias('pushtest2', url+'/pushtest2')
    .push('pushtest2', {foo: 'bar'}, function (err) {
      test.ifError(err)
      setImmediate(test.done)
    })
}

tests.push_error = function (test) {
  test.expect(4)
  app.post('/:path', function (req, res) {
    test.equal(req.params.path, 'pushtest3')
    test.equal(typeof req.body, 'object')
    test.equal(req.body.foo, 'bar')
    res.sendStatus(500)
  })
  qb.on('error', test.done)
    .component(qbHttp.push, baseOptions)
    .push(url + '/pushtest3', {foo: 'bar'}, function (err) {
      test.equal(err.toString(), 'Error: "Internal Server Error"')
      setImmediate(test.done)
    })
}

tests.push_retry = function (test) {
  test.expect(1)
  var called = false
  app.post('/retry', function (req, res) {
    if (called)
      res.sendStatus(200)
    else
      res.sendStatus(500)
    called = true
  })
  qb.on('error', test.done)
    .component(qbHttp.push, {retry: 1})
    .push(url + '/retry', {}, function (err) {
      test.ifError(err)
      setImmediate(test.done)
    })
}


tests.push_to_nowhere = function (test) {
  test.expect(1)
  qb.component(qbHttp.push)
    .on('error', test.ifError)
    .push('relyq://something:else', {}, function (err) {
      test.ifError(err)
      test.done()
    })
}