ORM
===

The orm is a single unit that manages configuration and model definitions. It is best practice to export an orm instance from a module so that it behaves like a singleton and can be easily required when creating models.

```js
// orm.js

var datastored = require('datastored');

var redis = require('redis');
var cassandra = require('cassandra-driver');

var namespace = 'project';
var cassandraClient = new cassandra.Client({
  contactPoints: ['localhost'],
  keyspace: namespace
});

module.exports = datastored.createOrm({
  redisNamespace: namespace,
  redis: redis.createClient(),
  cassandra: cassandraClient
});
```

## datastored.createOrm

- Options
  - generateId (function, optional)

    A function that calls an errback with a unique id on invocation. `generateId` defaults to lodash's `uniqueId`. Datastored requires this function to call back with a unique id in respect to the database. If the orm will be running on multiple nodes, use a package like [flake-idgen](https://github.com/T-PWK/flake-idgen) to generate unique, cluster-wide ids.
