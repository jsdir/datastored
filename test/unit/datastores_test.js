var _ = require('lodash');
var async = require('async');

var CassandraDatastore = require('../../lib/datastores/cassandra');
var RedisDatastore = require('../../lib/datastores/redis');
var MemoryDatastore = require('../../lib/datastores/memory');

var datastores = {
  //CassandraDatastore: CassandraDatastore,
  //RedisDatastore: RedisDatastore,
  MemoryDatastore: new MemoryDatastore()
};

_.each(datastores, function(datastore, name) {
  describe(name, function() {

    describe('#save()', function() {

      var baseOptions = {
        column: 'column',
        idName: 'id',
        data: {
          bar: 123,
          baz: 'foobar',
          foo: 'abc'
        }
      };

      xit('should treat data.value : null as deleting the value on save');

      it('should save a row with an id of type string', function(done) {
        var options = _.merge({}, baseOptions, {data: {id: 'foo'}});
        datastore.save(options, function(err) {
          datastore.fetch({
            column: 'column',
            id: 'foo',
            attributes: ['foo', 'bar', 'baz']
          }, function(err, data) {
            data.should.deep.eq({bar: 123, baz: 'foobar', foo: 'abc'});
            done(err);
          });
        });
      });

      it('should save a row with an id of type integer', function(done) {
        var options = _.merge({}, baseOptions, {data: {id: 2}});
        datastore.save(options, function(err) {
          datastore.fetch({
            column: 'column',
            id: 2,
            attributes: ['foo', 'bar', 'baz']
          }, function(err, data) {
            data.should.deep.eq({bar: 123, baz: 'foobar', foo: 'abc'});
            done(err);
          });
        });
      });

      xit('should save indexes', function(done) {
        var options = _.merge({}, baseOptions, {
          data: {id: 'foo'},
          indexNames: ['bar', 'baz']
        });

        datastore.save(options, function(err) {
          datastore.find({
            column: 'column',
            id: 'foo',
            attributes: ['foo', 'bar', 'baz']
          }, function(err, data) {
            data.should.deep.eq({bar: 123, baz: 'foobar', foo: 'abc'});
            done(err);
          });
        });
      });

      xit('should save partitions', function(done) {
        done();
      });

      xit('should update the row if it already exists', function(done) {
        done();
      });
    });

    xdescribe('#fetch()', function() {

      it('should only fetch the requested attributes', function() {

      });

      it('should callback with null if no row was found', function() {

      });
    });

    xdescribe('#find()', function() {

      it('should find a row by index', function() {

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
  });
});
