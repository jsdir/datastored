var redis = require('redis');
var helenus = require('helenus');

var cassandraClient = new helenus.ConnectionPool({
  hosts: ['localhost:9160'],
  keyspace: 'test',
  user: 'user',
  password: 'password',
  timeout: 3000,
  cqlVersion: '3.0.0'
});

module.exports = {
  redis: redis.createClient(),
  cassandra: cassandraClient,
  cassandraRun: function(cmd, cb) {
    cassandraClient.connect(function(err) {
      if (err) {
        throw err;
      } else {
        cassandraClient.cql(cmd, cb);
      }
    });
  }
};
