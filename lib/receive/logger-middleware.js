module.exports = logger

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