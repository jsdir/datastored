var _ = require('lodash');
var async = require('async');
var chai = require('chai');

var CassandraDatastore = require('../../lib/datastores/cassandra');
var RedisDatastore = require('../../lib/datastores/redis');
var MemoryDatastore = require('../../lib/datastores/memory');

chai.should();
var expect = chai.expect;

var datastores = {
  // CassandraDatastore: CassandraDatastore,
  // RedisDatastore: RedisDatastore,
  MemoryDatastore: new MemoryDatastore()
};

_.each(datastores, function(datastore, name) {
  describe(name, function() {

    beforeEach(function(cb) {
      datastore.reset(cb);
    });

    describe('#save()', function() {

      var baseOptions = {
        column: 'column',
        indexes: [],
        replaceIndexes: [],
        data: {
          bar: 123,
          baz: 'foobar'
        },
        types: {
          bar: 'integer',
          baz: 'string'
        }
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

      it('should save a row with an id of type string', function(done) {
        var options = _.merge({}, baseOptions, {id: 'foo'});
        datastore.save(options, function(err) {
          datastore.fetch({
            column: 'column',
            ids: ['foo'],
            attributes: ['bar', 'baz']
          }, function(err, data) {
            if (err) {return done(err);}
            data.should.deep.eq({foo: {bar: 123, baz: 'foobar'}});
            done();
          });
        });
      });

      it('should save a row with an id of type integer', function(done) {
        var options = _.merge({}, baseOptions, {id: 2});
        datastore.save(options, function(err) {
          datastore.fetch({
            column: 'column',
            ids: [2],
            attributes: ['bar', 'baz']
          }, function(err, data) {
            if (err) {return done(err);}
            data.should.deep.eq({2: {bar: 123, baz: 'foobar'}});
            done();
          });
        });
      });

      function saveIndexedModel(value, replaceIndexValues, cb) {
        var options = _.merge({}, baseOptions, {
          id: 'foo', indexes: ['bar'], data: {bar: value},
          replaceIndexValues: replaceIndexValues
        });
        datastore.save(options, cb);
      }

      it('should save indexes', function(done) {
        saveIndexedModel(123, [], function(err) {
          if (err) {done(err);}
          assertFind('column', 'bar', 123, 'foo', done);
        });
      });

      it('should not replace indexes when requested', function(done) {
        async.series([
          function(cb) {
            saveIndexedModel(123, {}, cb);
          },
          function(cb) {
            saveIndexedModel(456, {}, cb);
          }
        ], function(err) {
          if (err) {done(err);}
          async.parallel([
            function(cb) {
              assertFind('column', 'bar', 456, 'foo', cb);
            },
            function(cb) {
              assertFind('column', 'bar', 123, 'foo', cb);
            }
          ], done);
        });
      });

      it('should replace indexes when requested', function(done) {
        async.series([
          function(cb) {
            saveIndexedModel(123, {}, cb);
          },
          function(cb) {
            saveIndexedModel(456, {bar: 123}, cb);
          }
        ], function(err) {
          if (err) {done(err);}
          async.parallel([
            function(cb) {
              assertFind('column', 'bar', 456, 'foo', cb);
            },
            function(cb) {
              assertFind('column', 'bar', 123, undefined, cb);
            }
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
              attributes: ['bar', 'baz']
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

    xdescribe('#fetch()', function() {

      it('should only fetch the requested attributes', function() {

      });

      it('should callback with null if no row was found', function() {

      });
    });

    xdescribe('#destroy()', function() {

      it('should destroy the row', function() {
        // check presence with fetch
      });

      it('should destroy all indexes', function() {

      });
    });

    xdescribe('#incr()', function() {

      it('should increment a column within a row', function() {
        // check +, 0, -
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
