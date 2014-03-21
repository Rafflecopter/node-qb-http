
var _ = require('underscore'),
  express = require('express');

var qbPkg = require('qb'),
  qb;

// If we are getting a test.done complaint, turn this on. It helps find errors
process.on('uncaughtException', function (err) {
  console.error(err.stack);
});

createTests('http', require('..'), {
  port: 8777,
  base: '/api'
}, 'http://127.0.0.1:8777/api')

function createTests(dialectName, dialect, options, endpoint) {
  var tests = exports[dialectName] = {};

  tests.setUp = function (cb) {
    qb = new qbPkg.QB({prefix:'qb1'});
    cb();
  }

  tests.tearDown = function (cb) {
    qb.end();
    cb();
  }

  tests.nothing = function (test) {
    qb.speaks(dialect, options)
      .on('error', test.done)
      .can('testf', function (task, done) {
        test.done(new Error('shouldnt be here'));
      })
      .start();

    var caller = qb.contact(endpoint);
    process.nextTick(test.done);
  }

  tests.basic_push = function basic_push(test) {
    qb.speaks(dialect, options)
      .on('error', test.done)
      .pre('push', function (type, task, next) {
        task.push = true;
        next();
      })
      .can('fn', function (task, done) {
        test.equal(task.push, true);
        test.equal(task.heli, 'copter');
        done();
      })
      .on('finish', function () {
        test.done();
      })
      .start()
      .contact(endpoint)
        .push('fn', {heli: 'copter'}, test.ifError);
  }

  tests.multiple_pushes = function multiple_pushes(test) {
    var i = 0, j = 0;
    qb.speaks(dialect, options)
      .on('error', test.done)
      .can('cnt', function (task, done) {
        test.equal(task.i, i++);
        done();
      })
      .on('finish', function () {
        if (i == 3) {
          test.done();
        }
      })
      .start()
      .contacts(endpoint, 'alias');

    qb.contact('alias')
      .push('cnt', {i: j++}, test.ifError)
      .push('cnt', [{i: j++}, {i: j++}], test.ifError);
  }

  tests.badtask = function badtask(test) {
    qb.speaks(dialect, options)
      .on('error', test.done)
      .can('something', function (task, done) {
        test.done(new Error('not supposed to be here'))
      })
      .start()

    qb.contact(endpoint).push('something-plus', {'other': 'else'}, function (err) {
      test.ok(err)
      test.done()
    })
  }

  tests.onaction = function onaction(test) {
    test.expect(1);
    var myoptions = _.clone(options)
    myoptions.onaction = function (req, res, err) {
      res.send(500, 'ALWAYSERR')
    }

    qb.speaks(dialect, myoptions)
      .on('error', test.done)
      .can('something', function (task, done) {
        done()
      })
      .start()

    qb.contact(endpoint).push('something', {}, function (err) {
      test.ok(/ALWAYSERR/.test(err.toString()))
      test.done()
    })
  }
}

exports.http.passed_in_app = function passed_in_app(test) {
  var app = express().use(express.json()),
    server = app.listen(8912);

  qb.speaks(require('..'), {app: app, base: '/passin'})
    .on('error', test.done)
    .pre('push', function (type, task, next) {
      task.push = true;
      next();
    })
    .can('fn', function (task, done) {
      test.equal(task.push, true);
      test.equal(task.heli, 'copter');
      done();
    })
    .on('finish', function () {
      finish();
    })
    .start()
    .contacts('http://localhost:8912/passin')
      .push('fn', {heli: 'copter'}, test.ifError);

  function finish() {
    server.close();
    test.done();
  }
}