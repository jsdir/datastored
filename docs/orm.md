## ORM

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

### Options

`datastored.createOrm(options)` can use the following options:

#### redisClient

A [redis client](https://github.com/mranney/node_redis).

#### cassandraClient

A [cassandra client](https://github.com/jorgebay/node-cassandra-cql).

#### memory

If set to `true`, the orm will use in-memory datastores instead of redis and cassandra. This is useful for testing. Defaults to `false`.

#### generateId

A function that calls an errback with a unique id on invocation. `generateId` defaults to lodash's `uniqueId`.

```js
var settings = {
  generateId: function(cb) {
    generateIdAsync(function(err, id) {
      cb(err, id);
    });
  }
};
```

#### redisNamespace

Defines the namespace for redis to use. This option is useful when running multiple orm instances on the same redis server. The default namespace is `ds`.

#### mutators

Defines mutators to use for each model instance. More documentation about mutators can be found [here](mutators.md).

#### marshaller

Defines a default marshaller to use for each model. This can be overridden per model. `modelMarshaller` defaults to `marshallers.JSONMarshaller`. A list of available marshallers is documented [here](marshallers.md).
