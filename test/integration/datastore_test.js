var _ = require('lodash');
var async = require('async');
var chai = require('chai');
var redis = require('redis');
var pg = require('pg');

var datastored = require('../..');

chai.should();
var expect = chai.expect;

function testHashStore(getHashStore) {

  before(function() {
    this.hashStore = getHashStore.call(this);
  });

  beforeEach(function(done) {
    this.hashStore.reset(done);
  });

  var date = 1264982400000;
  var datetime = 1264982400000;

  var options = {
    keyspace: 'keyspace'
  };

  var typeOptions = _.extend({}, options, {
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
  });

  var counterOptions = _.extend({}, options, {
    id: 2,
    data: {
      string: 'foo'
    },
    types: {
      string: 'string',
      counter1: 'integer',
      counter2: 'integer'
    },
    counters: ['counter1', 'counter2']
  });

  var typeFetchOptions = _.extend({attributes: [
    'integer', 'string', 'booleanTrue', 'booleanFalse', 'date', 'datetime'
  ]}, typeOptions);

  var counterFetchOptions = _.extend({attributes: [
    'string', 'counter1', 'counter2'
  ]}, counterOptions);

  beforeEach(function(done) {
    this.hashStore.save(_.extend({}, typeOptions, {insert: true}), done);
  });

  describe('#save()', function() {

    it('should persist values of all types', function(done) {
      this.hashStore.fetch(typeFetchOptions, function(err, data) {
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
      var hashStore = this.hashStore;
      var saveOptions = _.extend({}, typeOptions, {
        data: {
          integer: 123,
          string: 'foo',
          booleanTrue: null,
          booleanFalse: null,
          date: null,
          datetime: null
        }
      });

      hashStore.save(saveOptions, function(err) {
        if (err) {return done(err);}
        hashStore.fetch(typeFetchOptions, function(err, data) {
          if (err) {return done(err);}
          data.should.deep.eq({integer: 123, string: 'foo'});
          done();
        });
      });
    });

    it('should initialize all counters with 0', function(done) {
      var hashStore = this.hashStore;
      var saveOptions = _.extend({}, counterOptions, {insert: true});

      hashStore.save(saveOptions, function(err) {
        if (err) {return done(err);}
        hashStore.fetch(counterFetchOptions, function(err, data) {
          if (err) {return done(err);}
          data.should.deep.eq({string: "foo", counter1: 0, counter2: 0});
          done();
        });
      });
    });

    it('should increment and decrement counters', function(done) {
      var hashStore = this.hashStore;
      var saveOptions = _.extend({}, counterOptions, {insert: true});
      var updateOptions = _.extend({}, counterOptions, {
        data: {string: "bar"},
        incr: {counter1: 2, counter2: -3}
      });

      async.series([
        function(cb) {hashStore.save(saveOptions, cb);},
        function(cb) {hashStore.save(updateOptions, cb);},
        function(cb) {hashStore.save(updateOptions, cb);},
        function(cb) {
          hashStore.fetch(counterFetchOptions, function(err, data) {
            if (err) {return cb(err);}
            data.should.deep.eq({string: "bar", counter1: 4, counter2: -6});
            cb();
          });
        }
      ], done);
    });
  });

  describe('#fetch()', function() {

    it('should only fetch the requested attributes', function(done) {
      var options = _.extend({}, typeFetchOptions, {
        attributes: ['integer', 'string']
      });

      this.hashStore.fetch(options, function(err, data) {
        if (err) {return done(err);}
        data.should.deep.eq({integer: 123, string: 'foo'});
        done();
      });
    });

    it('should callback "null" if the hash was not found', function(done) {
      var options = _.extend(typeFetchOptions, {id: 2});
      this.hashStore.fetch(options, function(err, data) {
        if (err) {return done(err);}
        expect(data).to.be.null;
        done();
      });
    });
  });
}

function testIndexStore(getIndexStore) {

  before(function() {
    this.indexStore = getIndexStore.call(this);
  });

  beforeEach(function(done) {
    this.indexStore.reset(done);
  });

  var options = {
    keyspace: 'keyspace',
    attributeName: 'attribute',
    attributeValue: 1,
    id: 'foo',
    types: {attribute: 'integer', id: 'string'}
  };

  beforeEach(function(done) {
    this.indexStore.set(options, done);
  });

  describe('#set()', function() {

    it('should set an index', function(done) {
      this.indexStore.get(options, function(err, id) {
        if (err) {return done(err);}
        id.should.eq('foo');
        done();
      });
    });

    it('should indicate if the key does not exist', function(done) {
      var testOptions = _.extend({}, options, {attributeValue: 2});
      this.indexStore.set(testOptions, function(err, exists) {
        if (err) {return done(err);}
        exists.should.be.false;
        done();
      });
    });

    it('should indicate if the key already exists', function(done) {
      this.indexStore.set(options, function(err, exists) {
        if (err) {return done(err);}
        exists.should.be.true;
        done();
      });
    });
  });

  describe('#get()', function() {

    it('should callback "null" if the key does not exist', function(done) {
      var testOptions = _.extend({}, options, {attributeValue: 2});
      this.indexStore.get(testOptions, function(err, id) {
        if (err) {return done(err);}
        expect(id).to.be.null;
        done();
      });
    });
  });

  describe('#del()', function() {

    it('should remove an index', function(done) {
      var indexStore = this.indexStore;
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
    testHashStore(function() {
      return new datastored.MemoryHashStore();
    });
  });

  describe('MemoryIndexStore', function() {
    testIndexStore(function() {
      return new datastored.MemoryIndexStore();
    });
  });
});

describe('Redis datastores >', function() {

  before(function() {
    this.client = redis.createClient();
  });

  describe('RedisHashStore', function() {
    testHashStore(function() {
      return new datastored.RedisHashStore(this.client);
    });
  });

  describe('RedisIndexStore', function() {
    testIndexStore(function() {
      return new datastored.RedisIndexStore(this.client);
    });
  });
});

describe('Postgres datastores >', function() {

  before(function(done) {
    // {user: "postgres", database: "test"}
    this.client = new pg.Client('postgres://postgres@localhost/test');
    this.client.connect(done);
  });

  describe('PostgresHashStore', function() {
    testHashStore(function() {
      return new datastored.PostgresHashStore(this.client);
    });
  });
});

xdescribe('Cassandra datastores >', function() {

});
