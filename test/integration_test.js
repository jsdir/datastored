var chai = require('chai');
var async = require('async');

var databases = require('./databases');
var Orm = require('..');

var expect = chai.expect;
chai.should();

describe('ORM', function() {

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
      bar: {
        index: true,
        type: 'string'
      }
    }
  });

  after(function(done) {
    async.parallel([
      function(cb) {databases.cassandraRun('TRUNCATE integration1;', cb);},
      function(cb) {databases.redis.del('keyspace:integration1:value', cb);}
    ], done);
  });

  it('should create new models', function(done) {
    var model = new BasicModel();
    model.set('foo', 'foo');
    model.set('bar', 'bar');
    model.save(function(err) {
      if (err) {
        throw err;
      } else {
        // TODO: check for model not found errors.
        //console.log('saved new');
        var fetchModel = new BasicModel('generated_id');
        fetchModel.fetch(null, function(err) {
          if (err) {
            throw err;
          } else {
            //console.log('fetch');
            //console.log(fetchModel.show());
            done();
          }
        });
      }
    });
  });

  it('should update existing models', function(done) {
    var model = new BasicModel();
    model.set('primary_key', 'value');
    model.set('foo', 'foo');
    //model.set('bar', 'bar');
    model.save(function(err) {
      if (err) {
        throw err;
      } else {
        //console.log('save');
        var fetchModel = new BasicModel('value');
        fetchModel.fetch(null, function(err) {
          if (err) {
            throw err;
          } else {
            //console.log('fetch');
            //console.log(fetchModel.show());
            done();
          }
        });
      }
    });
  });

  it('should find models by index', function(done) {
    var model = new BasicModel();
    model.set('primary_key', 'value');
    model.set('foo', 'foo');
    model.set('bar', 'foobar');

    async.series([
      function(cb) {
        model.save(cb);
      },
      function(cb) {
        // Wait for the entry to be inserted in redis before moving on.
        setTimeout(cb, 10);
      },
      function(cb) {
        BasicModel.find({bar: 'foobar'}, function(err, model) {
          if (err) {
            cb(err);
          } else {
            model.get('primary_key').should.equal('value');
            cb();
          }
        });
      }
    ], done);
  });

  it('should respond find models by index', function(done) {
    BasicModel.find({bar: 'undefinedIndex'}, function(err, model) {
      if (err) {
        throw err;
      } else {
        expect(model).to.not.exist;
        done();
      }
    });
  });
});
