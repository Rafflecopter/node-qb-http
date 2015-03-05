var async = require('async')

module.exports = {
  verifyType: verifyType
, push: pushEndpoint
, deleteDefer: deleteUndeferEndpoint
}

function verifyType(qb) {
  return function (req, res, next) {
    var type = req.params.type

    if (!qb._types[type])
      return res.jsonp(404, new Error('this service cannot perform tasks of type ' + type))
    next()
  }
}

function pushEndpoint(qb, reply) {
  reply = reply || defaultReply
  return function (req, res, next) {
    var type = req.params.type
      , body = Array.isArray(req.body) ? req.body : [req.body];

    async.each(body, function (task, cb) {
      qb.push(type, task, cb)
    }, reply.bind(null, req, res))
  }
}

function deleteUndeferEndpoint(qb, reply) {
  reply = reply || defaultReply
  return function (req, res, next) {
    var type = req.params.type
      , id = req.params.id;

    qb.undefer_remove(queue, id, onaction.bind(null, req, res));
  }
}


function defaultReply(req, res, err) {
  if (err) {
    res.jsonp(500, {error: err.message, stack: err.stack});
  } else {
    res.jsonp({ok:true, type: req.type});
  }
}