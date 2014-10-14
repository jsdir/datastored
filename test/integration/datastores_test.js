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
    tables: ['test_table', 'test_table_int']
  }),
  RedisDatastore: new RedisDatastore({
    client: redis.createClient(),
    keyspace: 'datastored_test'
  }),
  MemoryDatastore: new MemoryDatastore()
};

// delete datastores.CassandraDatastore;
// delete datastores.RedisDatastore;
delete datastores.MemoryDatastore;

_.each(datastores, function(datastore, name) {
  describe(name, function() {

    var isCassandra = (name === 'CassandraDatastore');

    var baseTypes = {
      bar: 'integer',
      baz: 'string',
      booleanTrue: 'boolean',
      booleanFalse: 'boolean',
      datetime: 'datetime',
      date: 'date',
      id: 'string'
    };

    var datetime = 1264982400000;
    var date = 1264982400000;

    var baseOptions = {
      idName: 'id',
      table: 'test_table',
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

    beforeEach(function(cb) {
      datastore.reset(cb);
    });

    function assertFind(options, id, cb) {
      datastore.find(options, function(err, res) {
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

    describe('#save()', function() {

      it('should save a row with an id of type string', function(done) {
        async.parallel([
          function(cb) {
            // Save with string id.
            var options = _.merge({}, baseOptions, {id: 'foo'});
            datastore.save(options, function(err) {
              if (err) {return cb(err);}
              datastore.fetch({
                table: 'test_table',
                id: 'foo',
                idName: 'id',
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
                if (err) {return cb(err);}
                data.bar.should.eq(123);
                data.baz.should.eq('foobar');
                data.booleanTrue.should.be.true;
                data.booleanFalse.should.be.false;
                data.datetime.getTime().should.equal(datetime);
                data.date.getTime().should.equal(date);
                cb();
              });
            });
          },
          function(cb) {
            // Save with string id.
            var options = _.merge({}, baseOptions, {id: 'foos'});
            datastore.save(options, function(err) {
              if (err) {return cb(err);}
              datastore.fetch({
                table: 'test_table',
                id: 'foos',
                idName: 'id',
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
                if (err) {return cb(err);}
                data.bar.should.eq(123);
                data.baz.should.eq('foobar');
                data.booleanTrue.should.be.true;
                data.booleanFalse.should.be.false;
                data.datetime.getTime().should.equal(datetime);
                data.date.getTime().should.equal(date);
                cb();
              });
            });
          }
        ], done);
      });

      it('should save a row with an id of type integer', function(done) {
        // Save with integer id.
        var options = _.merge({}, baseOptions, {
          id: 2, table: 'test_table_int', types: {id: 'integer'}
        });
        datastore.save(options, function(err) {
          if (err) {return done(err);}
          datastore.fetch({
            table: 'test_table_int',
            id: 2,
            idName: 'id',
            attributes: ['bar', 'baz'],
            types: _.extend({}, baseTypes, {id: 'integer'})
          }, function(err, data) {
            if (err) {return done(err);}
            data.should.deep.eq({bar: 123, baz: 'foobar'});
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
              table: 'test_table',
              id: 'foo',
              idName: 'id',
              attributes: ['bar', 'baz'],
              types: baseTypes
            }, function(err, data) {
              if (err) {return cb(err);}
              data.should.deep.eq({bar: 123, baz: 'foo'});
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
              table: 'test_table',
              id: 'foo',
              idName: 'id',
              attributes: ['bar', 'baz'],
              types: baseTypes
            }, function(err, data) {
              if (err) {return cb(err);}
              data.bar.should.eq(456);
              expect(data.baz).to.be.undefined;
              cb();
            });
          }
        ], done);
      });

      // CassandraDatastore should not implement these yet.
      if (!isCassandra) {

        function assertHasIndex(value, id, cb) {
          assertFind({
            table: 'test_table',
            index: 'bar',
            value: value,
            types: {bar: 'integer'}
          }, id, cb);
        }

        it('should increment tables within a row', function(done) {
          var options = {
            id: 'foo', idName: 'id', table: 'count',
            types: {i1: 'integer', i2: 'integer', i3: 'integer', id: 'string'}
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
                id: 'foo', attributes: ['i1', 'i2', 'i3']
              });
              datastore.fetch(saveOptions, function(err, data) {
                data.should.deep.eq({i1: 0, i2: 2, i3: 4});
                done();
              });
            });
          });
        });

        it('should save indexes', function(done) {
          saveIndexedModel(123, {}, function(err) {
            if (err) {return done(err);}
            assertHasIndex(123, 'foo', done);
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
              function(cb) {assertHasIndex(123, 'foo', cb);},
              function(cb) {assertHasIndex(456, 'foo', cb);}
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
              function(cb) {assertHasIndex(456, 'foo', cb);},
              function(cb) {assertHasIndex(123, null, cb);}
            ], done);
          });
        });
      }
    });

    function fetchModel(cb, id) {
      datastore.fetch({
        table: 'test_table',
        id: id || 'foo',
        idName: 'id',
        attributes: ['bar'],
        types: baseTypes
      }, cb);
    }

    describe('#fetch()', function() {

      beforeEach(function(cb) {
        var options = _.merge({}, baseOptions, {id: 'foo'});
        datastore.save(options, cb);
      });

      it('should only fetch the requested attributes', function(done) {
        fetchModel(function(err, data) {
          if (err) {return done(err);}
          data.should.deep.eq({bar: 123});
          done();
        });
      });

      it('should callback with null if no row was found', function(done) {
        fetchModel(function(err, data) {
          if (err) {return done(err);}
          expect(data).to.not.exist;
          done();
        }, 'undefined');
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
        datastore.destroy({
          table: 'test_table', id: 'foo', idName: 'id', types: baseTypes
        }, function(err) {
          if (err) {return done(err);}
          fetchModel(function(err, data) {
            if (err) {return done(err);}
            expect(data).to.not.exist;
            done();
          });
        });
      });

      /*
      if (!isCassandra) {

        it('should destroy all indexes', function(done) {
          async.series([
            function(cb) {saveIndexedModel(124, {}, cb);},
            function(cb) {saveIndexedModel(456, {bar: 124}, cb);},
            function(cb) {
              var options = _.merge({}, baseOptions, {
                id: 'foo', idName: 'id', indexes: ['bar', 'baz'], data: {baz: 'baz'}
              });
              datastore.save(options, cb);
            }
          ], function(err) {
            if (err) {return done(err);}
            datastore.destroy({
              table: 'test_table', id: 'foo', idName: 'id', indexValues: {
                values: {bar: [456], baz: ['baz']}, // current values from orm
                replaceIndexes: ['bar']
              }, types: baseTypes
            }, function(err) {
              if (err) {return done(err);}
              // Ensure indexes are deleted.
              async.parallel([
                function(cb) {assertFind('test_table', 'bar', 124, null, cb);},
                function(cb) {assertFind('test_table', 'bar', 456, null, cb);},
                function(cb) {assertFind('test_table', 'baz', 'baz', null, cb);}
              ], done);
            });
          });
        });
      }*/
    });

    if (!isCassandra) { // Temporary.

      describe('#addToCollection()', function() {

        it('should add instances to a list', function(done) {
          async.series([
            function addToEmptyList(cb) {
              // Add multiple ids to an empty list.
              datastore.addToCollection({
                table: 'test_table',
                id: 'foo',
                idName: 'id',
                types: {id: 'string'},
                relationName: 'children',
                instances: [{id: 1, idType: 'integer'}, {id: 2, idType: 'integer'}]
              }, cb);
            },
            function addToExistingList(cb) {
              // Add multiple ids to an existing list.
              datastore.addToCollection({
                table: 'test_table',
                id: 'foo',
                idName: 'id',
                types: {id: 'string'},
                relationName: 'children',
                instances: [{id: 3, idType: 'integer'}, {id: 4, idType: 'integer'}]
              }, cb);
            },
            function checkIds(cb) {
              // Check that ids were stored.
              datastore.fetchCollection({
                table: 'test_table',
                id: 'foo',
                idName: 'id',
                types: {id: 'string'},
                relationName: 'children',
                childIdType: 'integer',
                start: 0,
                end: -1
                /*,
                childIdType xor idTypes: {
                  0: 'string',
                  1: 'string'
                }*/
              }, function(err, data) {
                if (err) {return cb(err);}
                data.should.deep.eq([{id: 1}, {id: 2}, {id: 3}, {id: 4}]);
                cb();
              });
            }
          ], done);
        });

        xit('should add typed instances to a list', function(done) {

        });
      });

      xdescribe('#fetchCollection()', function() {

        beforeEach(function(done) {
          saveCollection('key', [1, 2, 3, 4], done);
        });

        it('should fetch a nonexistent collection', function(done) {
          assertFetchEquals('undefined', [], done);
        });

        it('should fetch an empty collection', function(done) {
          saveCollection('key', [1, 2, 3, 4], function(err) {
            if (err) {return done(err);}
            assertFetchEquals('key', [], done);
          });
        });

        it('should limit returned results', function(done) {
          assertFetchEquals('key', {limit: 2}, [1, 2], done);
        });

        it('should offset returned results', function() {
          assertFetchEquals('key', {limit: 2, offset: 1}, [2, 3], done);
        });
      });

      xdescribe('#fetchTree', function() {

      });
    }
  });
});
