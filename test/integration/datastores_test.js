var _ = require('lodash');
var async = require('async');
var chai = require('chai');
var redis = require('redis');
var cassandra = require('cassandra-driver');

var CassandraDatastore = require('../../lib/datastores/cassandra');
var RedisDatastore = require('../../lib/datastores/redis');
var MemoryDatastore = require('../../lib/datastores/memory');

chai.should();
var expect = chai.expect;

var datastores = {
  CassandraDatastore: new CassandraDatastore({
    client: new cassandra.Client({
      contactPoints: ['localhost'],
      keyspace: 'datastored_test'
    }),
    tables: ['table']
  }),
  RedisDatastore: new RedisDatastore({
    client: redis.createClient(),
    keyspace: 'datastored_test'
  }),
  MemoryDatastore: new MemoryDatastore()
};

_.each(datastores, function(datastore, name) {
  describe(name, function() {

    var isCassandra = (name === 'CassandraDatastore');

    beforeEach(function(cb) {
      datastore.reset(function(err) {
        if (err) {return cb(new Error(err))}
        cb();
      });
    });

    var baseTypes = {
      bar: 'integer',
      baz: 'string',
      booleanTrue: 'boolean',
      booleanFalse: 'boolean',
      datetime: 'datetime',
      date: 'date'
    };

    var datetime = 1264982400000;
    var date = 1264982400000;

    var baseOptions = {
      table: 'table',
      indexes: [],
      replaceIndexes: [],
      data: {
        bar: 123,
        baz: 'foobar',
        booleanTrue: true,
        booleanFalse: false,
        datetime: new Date(datetime),
        date: new Date(date)
      },
      types: baseTypes
    };

    function assertFind(table, index, value, id, cb) {
      datastore.find({
        table: table, index: index, value: value
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
        table: 'table', ids: [id], attributes: ['bar'], types: baseTypes
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
            table: 'table',
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
            data['foo'].datetime.getTime().should.equal(datetime);
            data['foo'].date.getTime().should.equal(date);
            done();
          });
        });
      });

      it('should save a row with an id of type integer', function(done) {
        var options = _.merge({}, baseOptions, {id: 2, table: 'table_int'});
        datastore.save(options, function(err) {
          if (err) {return done(err);}
          datastore.fetch({
            table: 'table_int',
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

      it('should overwrite existing values', function(done) {
         async.series([
          function(cb) {
            var options = _.merge({}, baseOptions, {id: 'foo'});
            datastore.save(options, cb);
          },
          function(cb) {
            var options = _.merge({}, baseOptions, {
              id: 'foo', data: {baz: 'foo'}
            });
            datastore.save(options, cb);
          },
          function(cb) {
            datastore.fetch({
              table: 'table',
              ids: ['foo'],
              attributes: ['bar', 'baz'],
              types: baseTypes
            }, function(err, data) {
              if (err) {return cb(err);}
              data['foo'].bar.should.eq(123);
              data['foo'].baz.should.eq('foo');
              cb();
            });
          }
        ], done);
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
              table: 'table',
              ids: ['foo'],
              attributes: ['bar', 'baz'],
              types: baseTypes
            }, function(err, data) {
              if (err) {return cb(err);}
              data['foo'].bar.should.eq(456);
              expect(data['foo'].baz).to.be.undefined;
              cb();
            });
          }
        ], done);
      });

      // CassandraDatastore should not implement these yet.
      if (!isCassandra) {

        it('should increment tables within a row', function(done) {
          var options = {
            id: 'foo', table: 'count',
            types: {i1: 'integer', i2: 'integer', i3: 'integer'}
          };

          var saveOptions = _.extend({}, options, {data: {i1: 1, i2: 2, i3: 3}});
          datastore.save(saveOptions, function(err) {
            if (err) {return done(err);}
            var saveOptions = _.extend({}, options, {
              increments: {i1: -1, i2: 0, i3: 1}
            });
            datastore.save(saveOptions, function(err) {
              if (err) {return done(err);}
              var saveOptions = _.extend({}, options, {
                ids: ['foo'], attributes: ['i1', 'i2', 'i3']
              });
              datastore.fetch(saveOptions, function(err, data) {
                data['foo'].should.deep.eq({i1: 0, i2: 2, i3: 4});
                done();
              });
            });
          });
        });

        it('should save indexes', function(done) {
          saveIndexedModel(123, {}, function(err) {
            if (err) {done(err);}
            assertFind('table', 'bar', 123, 'foo', done);
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
              function(cb) {assertFind('table', 'bar', 456, 'foo', cb);},
              function(cb) {assertFind('table', 'bar', 123, 'foo', cb);}
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
              function(cb) {assertFind('table', 'bar', 456, 'foo', cb);},
              function(cb) {assertFind('table', 'bar', 123, null, cb);}
            ], done);
          });
        });
      }
    });

    describe('#fetch()', function() {

      beforeEach(function(cb) {
        var options = _.merge({}, baseOptions, {id: 'foo'});
        datastore.save(options, cb);
      });

      it('should only fetch the requested attributes', function(done) {
        datastore.fetch({
          table: 'table', ids: ['foo'], attributes: ['bar'], types: baseTypes
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
        datastore.destroy({table: 'table', ids: ['foo']}, function(err) {
          if (err) {return done(err);}
          assertNotFound('foo', done);
        });
      });

      if (!isCassandra) {

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
              table: 'table', ids: ['foo'], indexValues: {
                values: {bar: [456], baz: ['baz']}, // current values from orm
                replaceIndexes: ['bar']
              }
            }, function(err) {
              if (err) {return done(err);}
              // Ensure indexes are deleted.
              async.parallel([
                function(cb) {assertFind('table', 'bar', 124, null, cb);},
                function(cb) {assertFind('table', 'bar', 456, null, cb);},
                function(cb) {assertFind('table', 'baz', 'baz', null, cb);}
              ], done);
            });
          });
        });
      }
    });

    if (!isCassandra) { // Temporary.
      xdescribe('#addToCollection()', function(done) {

      });

      xdescribe('#fetchCollection()', function() {

      });

      xdescribe('#fetchTree', function() {

      });
    }
  });
});
