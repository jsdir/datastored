var async = require('async');

var databases = require('./databases');
var Orm = require('..');

describe.only('ORM', function() {

  var orm = new Orm({
    redis: databases.redis,
    cassandra: databases.cassandra,
    redisKeyspace: 'keyspace',
    generateId: function(cb) {cb(null, 'generated_id');}
  });

  var BasicModel = orm.model('BasicModel', {
    table: 'integration1',
    attributes: {
      primary_key: {
        primary: true,
        type: 'string'
      },
      foo: {type: 'string'},
      bar: {type: 'string'}
    }
  });

  after(function(done) {
    async.parallel([
      function(cb) {databases.cassandraRun('TRUNCATE integration1;', cb);},
      function(cb) {databases.redis.del('keyspace:integration1:value', cb);}
    ], done);
  });

  it('should be functional', function(done) {
    var model = new BasicModel();
    model.set('primary_key', 'value');
    model.set('foo', 'foo');
    model.set('bar', 'bar');
    model.save(function(err) {
      if (err) {
        throw err;
      } else {
        console.log('save');
        var fetchModel = new BasicModel('value');
        fetchModel.fetch(function(err) {
          if (err) {
            throw err;
          } else {
            console.log('fetch');
          }
        });
      }
      done();
    });
  });
});
