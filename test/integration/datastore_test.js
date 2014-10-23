var _ = require('lodash');
var chai = require('chai');

var memoryDatastores = require('../../lib/datastores/memory');

chai.should();
var expect = chai.expect;

function testHashStore(hashStore) {

  describe('#save()', function() {

  });

  describe('#fetch()', function() {

  });
}

function testIndexStore(indexStore) {

  beforeEach(function(done) {
    indexStore.reset(done);
  });

  var options = {
    keyspace: 'keyspace',
    attributeName: 'attribute',
    attributeValue: 1,
    id: 'foo',
    types: {attribute: 'integer', id: 'string'}
  };

  beforeEach(function(done) {
    indexStore.set(options, done);
  });

  describe('#set()', function() {

    it('should set an index', function(done) {
      indexStore.get(options, function(err, id) {
        if (err) {return cb(err);}
        id.should.eq('foo');
        done();
      });
    });

    it('should indicate if the key does not exist', function(done) {
      var options = _.extend({}, options, {value: 2});
      indexStore.set(options, function(err, exists) {
        if (err) {return cb(err);}
        exists.should.be.false;
        done();
      });
    });

    it('should indicate if the key already exists', function(done) {
      indexStore.set(options, function(err, exists) {
        if (err) {return cb(err);}
        exists.should.be.true;
        done();
      });
    });
  });

  describe('#get()', function() {

    it('should callback "null" if the key does not exist', function(done) {
      var options = _.extend({}, options, {value: 2});
      indexStore.get(options, function(err, id) {
        if (err) {return cb(err);}
        expect(id).to.be.null;
        done();
      });
    });
  });

  describe('#del()', function() {

    it('should remove an index', function(done) {
      indexStore.del(options, function(err) {
        if (err) {return done(err);}
        indexStore.get(options, function(err, id) {
          if (err) {return done(err);}
          expect(id).to.be.null;
          done();
        });
      });
    });
  });
}

// Memory datastores

xdescribe('MemoryHashStore', function() {
  var memoryHashStore = new memoryDatastores.MemoryHashStore();
  testHashStore(memoryHashStore);
});

describe('MemoryIndexStore', function() {
  var indexStore = new memoryDatastores.MemoryIndexStore();
  testIndexStore(indexStore);
});
