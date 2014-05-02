datastored
==========

unified cache and persistent datastore for node.js

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
