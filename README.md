# qb-http

HTTP-based push and receive components for [qb](https://github.com/rafflecopter/node-qb). This allows you to use HTTP to communicate between service applications.

## Usage

The http dialect is simple.

```
npm install qb-http --save
```

```javascript
  // Receive component
qb.component(require('qb-http').receive, httpReceiveOptions)
  .on('http-ready', function () {
    console.log('http server is setup and ready to go')
  })

  // Push component
  .component(require('qb-http').push, httpPushOptions)
  .alias('foobar', 'http://my.other.service.com/api/v1/push/foobar')
  .push('foobar', {baz: buzz})
```

Also, here's the external API (if the `base` option is `/api/qb`:

```
$ curl http://server.domain.tld/api/qb/service-name -XPOST -H'Content-Type: application/json' -d'{"task": "data"}'
```


## Options

### Push Options

- `retry` Number of times to retry a http curl if an error is encountered.

### Receive Options

- `port` Port Number (if not present, server will not be started to listen)
- `unix` A path to a unix socket (only listened on if `port` is falsy)
- `app` Pass in an express app. If none is passed, one will be created.
- `base` Base api prefix
- `no_middleware` Dont attach middleware (body parser is the only required one. logging is suggested)
- `auth` A `{user: '', pass: ''}` object for basic auth
- `no_404_catch` Don't attach a catch-all at `base` to reply with a 404 Not Found
- `reply` A `function (req, res, error)` to respond to requests. Default uses `jsonp`

To access the underlying express server, use `qb._http.app` and `qb._http.server`.

## License

MIT in LICENSE file
