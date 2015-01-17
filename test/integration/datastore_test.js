var _ = require('lodash');
var chai = require('chai');
var redis = require('redis');

var memoryDatastores = require('../../lib/datastores/memory');
var redisDatastores = require('../../lib/datastores/redis');
var postgresDatastores = require('../../lib/datastores/postgres');

chai.should();
var expect = chai.expect;

function testHashStore(hashStore) {

  beforeEach(function(done) {
    hashStore.reset(done);
  });

  var date = 1264982400000;
  var datetime = 1264982400000;

  var options = {
    keyspace: 'keyspace',
    id: 1,
    data: {
      integer: 123,
      string: 'foo',
      booleanTrue: true,
      booleanFalse: false,
      date: new Date(date),
      datetime: new Date(datetime)
    },
    types: {
      id: 'integer',
      integer: 'integer',
      string: 'string',
      booleanTrue: 'boolean',
      booleanFalse: 'boolean',
      date: 'date',
      datetime: 'datetime'
    }
  };

  var fetchOptions = _.omit(options, 'data');
  var fetchAllOptions = _.extend({attributes: [
    'integer', 'string', 'booleanTrue', 'booleanFalse', 'date', 'datetime'
  ]}, fetchOptions);

  beforeEach(function(done) {
    hashStore.save(options, done);
  });

  describe('#save()', function() {

    it('should persist values of all types', function(done) {
      hashStore.fetch(fetchAllOptions, function(err, data) {
        if (err) {return done(err);}
        data.integer.should.eq(123);
        data.string.should.eq('foo');
        data.booleanTrue.should.eq(true);
        data.booleanFalse.should.eq(false);
        data.date.getTime().should.eq(date);
        data.datetime.getTime().should.eq(datetime);
        done();
      });
    });

    it('should remove attributes with "null"', function(done) {
      var saveOptions = _.clone(options);
      saveOptions.data = {
        integer: 123,
        string: 'foo',
        booleanTrue: null,
        booleanFalse: null,
        date: null,
        datetime: null
      };

      hashStore.save(saveOptions, function(err) {
        if (err) {return done(err);}
        hashStore.fetch(fetchAllOptions, function(err, data) {
          if (err) {return done(err);}
          data.should.deep.eq({integer: 123, string: 'foo'});
          done();
        });
      });
    });
  });

  describe('#fetch()', function() {

    it('should only fetch the requested attributes', function(done) {
      var options = _.extend({attributes: ['integer', 'string']}, fetchOptions);

      hashStore.fetch(options, function(err, data) {
        if (err) {return done(err);}
        data.should.deep.eq({integer: 123, string: 'foo'});
        done();
      });
    });

    it('should callback "null" if the hash was not found', function(done) {
      var options = _.extend({
        attributes: ['integer', 'string']
      }, fetchOptions, {id: 2});
      hashStore.fetch(options, function(err, data) {
        if (err) {return done(err);}
        expect(data).to.be.null;
        done();
      });
    });
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

describe('Memory datastores >', function() {

  describe('MemoryHashStore', function() {
    testHashStore(new memoryDatastores.MemoryHashStore());
  });

  describe('MemoryIndexStore', function() {
    testIndexStore(new memoryDatastores.MemoryIndexStore());
  });
});

xdescribe('Redis datastores >', function() {

  before(function() {
    this.client = redis.createClient();
  });

  describe('RedisHashStore', function() {
    testHashStore(new redisDatastores.RedisHashStore(this.client));
  });

  describe('RedisIndexStore', function() {
    testIndexStore(new redisDatastores.RedisIndexStore(this.client));
  });
});

xdescribe('PostgresHashStore', function() {

});

xdescribe('Cassandra datastores >', function() {

});
