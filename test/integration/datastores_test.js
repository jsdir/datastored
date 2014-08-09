var _ = require('lodash');
var async = require('async');
var chai = require('chai');
var redis = require('redis');
var cql = require('node-cassandra-cql');

var CassandraDatastore = require('../../lib/datastores/cassandra');
var RedisDatastore = require('../../lib/datastores/redis');
var MemoryDatastore = require('../../lib/datastores/memory');

chai.should();
var expect = chai.expect;

var datastores = {
  /*CassandraDatastore: new CassandraDatastore({
    client: new cql.Client({
      hosts: ['localhost:9042'],
      keyspace: 'datastored_test'
    }),
    columns: ['column']
  }),*/
  RedisDatastore: new RedisDatastore({
    client: redis.createClient(),
    keyspace: 'datastored_test'
  }),
  MemoryDatastore: new MemoryDatastore()
};

_.each(datastores, function(datastore, name) {
  describe(name, function() {

    beforeEach(function(cb) {
      datastore.reset(cb);
    });

    var baseTypes = {
      bar: 'integer',
      baz: 'string',
      booleanTrue: 'boolean',
      booleanFalse: 'boolean',
      datetime: 'datetime',
      date: 'date'
    };

    var baseOptions = {
      column: 'column',
      indexes: [],
      replaceIndexes: [],
      data: {
        bar: 123,
        baz: 'foobar',
        booleanTrue: true,
        booleanFalse: false,
        datetime: new Date(2010, 1, 2, 3, 4, 5, 6),
        date: new Date(2010, 1, 1)
      },
      types: baseTypes
    };

    function assertFind(column, index, value, id, cb) {
      datastore.find({
        column: column, index: index, value: value
      }, function(err, res) {
        if (err) {return cb(err);}
        expect(res).to.eq(id);
        cb();
      });
    }

    function saveIndexedModel(value, replaceIndexValues, cb) {
      var options = _.merge({}, baseOptions, {
        id: 'foo', indexes: ['bar'], data: {bar: value},
        replaceIndexValues: replaceIndexValues
      });
      datastore.save(options, cb);
    }

    function assertNotFound(id, cb) {
      datastore.fetch({
        column: 'column', ids: [id], attributes: ['bar'], types: baseTypes
      }, function(err, data) {
        if (err) {return cb(err);}
        var expectedData = {};
        expectedData[id] = null;
        data.should.deep.eq(expectedData);
        cb();
      });
    }

    describe('#save()', function() {

      it('should save a row with an id of type string', function(done) {
        var options = _.merge({}, baseOptions, {id: 'foo'});
        datastore.save(options, function(err) {
          if (err) {return done(err);}
          datastore.fetch({
            column: 'column',
            ids: ['foo'],
            attributes: [
              'bar',
              'baz',
              'booleanTrue',
              'booleanFalse',
              'datetime',
              'date'
            ],
            types: baseTypes
          }, function(err, data) {
            if (err) {return done(err);}
            data['foo'].bar.should.eq(123);
            data['foo'].baz.should.eq('foobar');
            data['foo'].booleanTrue.should.be.true;
            data['foo'].booleanFalse.should.be.false;
            data['foo'].datetime.getTime().should.equal(1265101445006);
            data['foo'].date.getTime().should.equal(1265004000000);
            done();
          });
        });
      });

      it('should save a row with an id of type integer', function(done) {
        var options = _.merge({}, baseOptions, {id: 2});
        datastore.save(options, function(err) {
          if (err) {return done(err);}
          datastore.fetch({
            column: 'column',
            ids: [2],
            attributes: ['bar', 'baz'],
            types: baseTypes
          }, function(err, data) {
            if (err) {return done(err);}
            data.should.deep.eq({2: {bar: 123, baz: 'foobar'}});
            done();
          });
        });
      });

      it('should save indexes', function(done) {
        saveIndexedModel(123, {}, function(err) {
          if (err) {done(err);}
          assertFind('column', 'bar', 123, 'foo', done);
        });
      });

      it('should keep indexes unique', function(done) {
        async.series([
          function(cb) {saveIndexedModel(123, {}, cb)},
          function(cb) {saveIndexedModel(123, {}, function(err) {
            err.should.eq('index already exists');
            cb();
          })}
        ], done);
      });

      it('should not replace indexes when requested', function(done) {
        async.series([
          function(cb) {saveIndexedModel(123, {}, cb);},
          function(cb) {saveIndexedModel(456, {}, cb);}
        ], function(err) {
          if (err) {done(err);}
          async.parallel([
            function(cb) {assertFind('column', 'bar', 456, 'foo', cb);},
            function(cb) {assertFind('column', 'bar', 123, 'foo', cb);}
          ], done);
        });
      });

      it('should replace indexes when requested', function(done) {
        async.series([
          function(cb) {saveIndexedModel(123, {}, cb);},
          function(cb) {saveIndexedModel(456, {bar: 123}, cb);}
        ], function(err) {
          if (err) {done(err);}
          async.parallel([
            function(cb) {assertFind('column', 'bar', 456, 'foo', cb);},
            function(cb) {assertFind('column', 'bar', 123, null, cb);}
          ], done);
        });
      });

      it('should delete row values when set to null', function(done) {
        async.series([
          function(cb) {
            var options = _.merge({}, baseOptions, {id: 'foo'});
            datastore.save(options, cb);
          },
          function(cb) {
            var options = _.merge({}, baseOptions, {
              id: 'foo',
              data: {bar: 456, baz: null}
            });
            datastore.save(options, cb);
          },
          function(cb) {
            datastore.fetch({
              column: 'column',
              ids: ['foo'],
              attributes: ['bar', 'baz'],
              types: baseTypes
            }, function(err, data) {
              if (err) {return done(err);}
              data['foo'].bar.should.eq(456);
              expect(data['foo'].baz).to.be.undefined;
              done();
            });
          }
        ], done);
      });
    });

    describe('#fetch()', function() {

      beforeEach(function(cb) {
        var options = _.merge({}, baseOptions, {id: 'foo'});
        datastore.save(options, cb);
      });

      it('should only fetch the requested attributes', function(done) {
        datastore.fetch({
          column: 'column', ids: ['foo'], attributes: ['bar'], types: baseTypes
        }, function(err, data) {
          if (err) {return cb(err);}
          data.should.deep.eq({
            foo: {bar: 123}
          });
          done();
        });
      });

      it('should callback with null if no row was found', function(done) {
        assertNotFound('bar', done);
      });
    });

    describe('#destroy()', function() {

      beforeEach(function(cb) {
        var options = _.merge({}, baseOptions, {
          id: 'foo', indexes: ['bar', 'baz']
        });
        datastore.save(options, cb);
      });

      it('should destroy the row', function(done) {
        datastore.destroy({column: 'column', ids: ['foo']}, function(err) {
          if (err) {return done(err);}
          assertNotFound('foo', done);
        });
      });

      it('should destroy all indexes', function(done) {
        async.series([
          function(cb) {saveIndexedModel(124, {}, cb);},
          function(cb) {saveIndexedModel(456, {bar: 124}, cb);},
          function(cb) {
            var options = _.merge({}, baseOptions, {
              id: 'foo', indexes: ['bar', 'baz'], data: {baz: 'baz'}
            });
            datastore.save(options, cb);
          }
        ], function(err) {
          datastore.destroy({
            column: 'column', ids: ['foo'], indexValues: {
              values: {bar: [456], baz: ['baz']}, // current values from orm
              replaceIndexes: ['bar']
            }
          }, function(err) {
            if (err) {return done(err);}
            // Ensure indexes are deleted.
            async.parallel([
              function(cb) {assertFind('column', 'bar', 124, null, cb);},
              function(cb) {assertFind('column', 'bar', 456, null, cb);},
              function(cb) {assertFind('column', 'baz', 'baz', null, cb);}
            ], done);
          });
        });
      });
    });

    describe('#incr()', function() {

      it('should increment a column within a row', function(done) {
        function testIncr(amount, result, cb) {
          datastore.incr({
            column: 'column', id: 'foo', attribute: 'bar', amount: amount
          }, function(err) {
            if (err) {return cb(err);}
            datastore.fetch({
              column: 'column',
              ids: ['foo'],
              attributes: ['bar'],
              types: baseTypes
            }, function(err, data) {
              if (err) {return cb(err);}
              data['foo'].bar.should.eq(result);
              cb();
            });
          });
        }

        var options = _.merge({}, baseOptions, {id: 'foo'});

        datastore.save(options, function(err) {
          if (err) {done(err);}
          async.series([
            function(cb) {testIncr(1, 124, cb);},
            function(cb) {testIncr(0, 124, cb);},
            function(cb) {testIncr(-3, 121, cb);}
          ], done);
        });
      });
    });

    /*
    xdescribe('#createCollection()', function() { // ?

    });

    xdescribe('#destroyCollection()', function() { // ?

    });

    xdescribe('#getCollectionSize()', function() {

    });

    xdescribe('#addToCollection()', function() {

    });

    xdescribe('#removeFromCollection()', function() {

      it('should remove values from set', function(done) {

      });

      it('should remove values from list', function(done) {

      });

      it('should remove values from sorted set', function(done) {

      });
    });

    xdescribe('#isMember()', function() {

      it('should show if a value is a member of a collection', function(done) {
        done();
      });
    });
    */
  });
});
