datastored
==========

Datastored is a failover-tolerant cache and persistent datastore for node.js using redis and cassandra.

[![Build Status](https://travis-ci.org/jsdir/datastored.svg?branch=master)](https://travis-ci.org/jsdir/datastored)
[![Dependency Status](https://david-dm.org/jsdir/datastored.svg)](https://david-dm.org/jsdir/datastored)


Usage
-----

```js
// orm.js
var redis = require('redis');
var helenus = require('helenus');
var Orm = require('datastored');

module.exports = new Orm({
  redis: redis.createClient(),
  cassandra: new helenus.ConnectionPool({
    hosts: ['localhost:9160'],
    keyspace: 'keyspace',
    user: 'user',
    password: 'password',
    timeout: 3000,
    cqlVersion: '3.0.0'
  })
});
```

```js
// models.js
var orm = require('./orm');

orm.model('User', {
  attributes: {
    username: {
      type: 'string'
    },
    name: {
      type: 'string'
    }
  }
});

module.exports = {
    User: orm.use('User')
};
```
