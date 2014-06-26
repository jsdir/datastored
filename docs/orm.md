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

**(required)** A [redis client](https://github.com/mranney/node_redis).

#### cassandraClient

**(required)** A [cassandra client](https://github.com/jorgebay/node-cassandra-cql).

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

#### modelTransforms

Datstored uses several base transforms on model for features such as hidden attributes and validation. These transforms cannot be changed. `modelTransforms` are added to the transform chain immediately after the immutable ones added by datastored.

#### modelMarshaller

Defines a default marshaller to use for each model. This can be overridden per model. `modelMarshaller` defaults to `marshaller.JSONMarshaller`. A list of available marshallers is documented [here](marshallers.md).
