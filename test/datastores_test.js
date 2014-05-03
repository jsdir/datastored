var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var redis = require('redis');
var helenus = require('helenus');

var datastores = require('../lib/datastores');

var expect = chai.expect;

chai.should();
chai.use(sinonChai);

var redisClient = redis.createClient();
var cassandraClient = new helenus.ConnectionPool({
  hosts: ['localhost:9160'],
  keyspace: 'test',
  user: 'user',
  password: 'password',
  timeout: 3000,
  cqlVersion: '3.0.0'
});


describe('RedisDatastore', function() {

  before(function() {
    this.rds = new datastores.RedisDatastore({
      redis: redisClient,
      redisKeyspace: 'test'
    }, {
      attributes: {
        primary_key: {type: 'string'},
        integer: {type: 'integer'},
        string: {type: 'string'},
        booleanTrue: {type: 'boolean'},
        booleanFalse: {type: 'boolean'},
        datetime: {type: 'datetime'},
        date: {type: 'date'}
      },
      table: 'table',
      pkAttribute: 'primary_key'
    });
  });

  it('persists to redis', function(done) {
    // Fetching with a primary key value that does not exist.
    // this.rds.fetch('modelType', 'id', 1234)
    var rds = this.rds;

    var datetime = new Date(2010, 1, 2, 3, 4, 5, 6);
    var date = new Date(2010, 1, 1);
    var attributes = ['integer', 'string', 'booleanTrue', 'booleanFalse',
      'datetime', 'date'];

    rds.save({
      primary_key: 'key',
      integer: 1234,
      string: 'string',
      booleanTrue: true,
      booleanFalse: false,
      datetime: datetime,
      date: date
    }, function() {
      rds.fetch('key', attributes, function(err, result) {
        result.integer.should.equal(1234);
        result.string.should.equal('string');
        result.booleanTrue.should.be.true
        result.booleanFalse.should.be.false
        result.datetime.getTime().should.equal(datetime.getTime());
        result.date.getTime().should.equal(date.getTime());
        redisClient.exists('test:table:key', function(err, exists) {
          exists.should.equal(1);
          done();
        });
      });
    });
  });
});

xdescribe('CassandraDatastore', function() {

  before(function() {
    this.cds = new datastores.CassandraDatastore({
      cassandra: cassandraClient
    }, {})
  });

  it('persists to cassandra', function(done) {
    var cds = this.cds;

    // Fetching with a primary key value that does not exist.
    //rds.fetch('modelType', 'id', 1234)

    cds.save('models', null, {
      id: 1234,
      foo: 'string1',
      foo2: 'string2',
      bar: 1,
      bar2: 2//new Date()
    }, function(err, result) {
      cds.fetch('models', 'id', 1234,
        ['foo2', 'bar', 'bar2']
      , function(err, result) {
        console.log('w');
        console.log(result[0].get('bar').value);
        done();
      });
    });
  });
});
