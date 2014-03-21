# qb-http

HTTP-based RPC dialect for communicating between and to [qb](https://github.com/rafflecopter/node-qb) instances.

## Usage

The http dialect is simple.

```
npm install qb-http --save
```

```javascript
qb.speaks(require('qb-http'), { port: 8000, base: '/qb-api' })
  .start()

  // Access a contact using http
  .contact('http://some.other.server.com/qb')
    // Push a task on to their 'service-name' queue
    .push('service-name', {task:'task',desc:'ription'})
    // Or push multiple tasks at once!
    .push('service-name', [task1, task2], callback /* and use a callback */ );

// Or you can create an alias
qb.contacts('http://some.other.server.com/qb', 'my-other-server')
  .contact('my-other-server').push('other-service', {task:'4',you:'!'});
```

Also, here's the curl api:

```
$ curl http://server.domain.tld/api/service-name -XPOST -H'Content-Type: application/json' -d'{"task": "data"}'
```


The `.speaks.start` starts up a simple express server, while the `.contact('http://...').push` uses request to communicate with another qb instance.

Options:

- `port` Port Number (if not present, no server will be started to listen)
- `app` Allows one to pass in an express app of their choosing.
- `base` Base api prefix
- `retry` Number of retries before quitting a push call.
- `onaction(req, res, err)` a method that is called after each push and delete action goes through the api. optional

To access the underlying express server, use `qb.dialect('http').app`.

## License

MIT in LICENSE file
