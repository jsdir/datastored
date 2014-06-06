ORM
===

The orm is a single unit that manages configuration and model definitions. It is best practice to export an orm instance from a module so that it behaves like a singleton and can be easily required when creating models.

```js
// orm.js

var datastored = require('datastored');

var redis = require('redis');
var cql = require('node-cassandra-cql');

var namespace = 'project';
var cassandraClient = new cql.Client({
  hosts: ['localhost:9160'],
  keyspace: namespace
});

module.exports = datastored.createOrm({
  redisNamespace: namespace,
  redis: redis.createClient(),
  cassandra: cassandraClient
});
```

Options
-------

`datastored.createOrm(settings)` has settings:

#### Required settings

- `redisClient`: a redis client
- `cassandraClient`: a [cassandra client](https://github.com/jorgebay/node-cassandra-cql)

#### Optional settings

- `generateId`: a function that calls an errback with a unique id on invocation. `generateId` defaults to uuid4.

```js
var settings = {
  generateId: function(cb) {
    generateIdAsync(function(err, id) {
      cb(err, id);
    });
  }
};
```

- `redisNamespace`: a namespace for redis to use. This option is useful when running multiple orm instances on the same redis server. The default namespace is `ds`.
