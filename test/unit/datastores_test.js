var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var expect = chai.expect;

chai.should();
chai.use(sinonChai);

var datastores = require('../../lib/datastores.js');


describe('RedisDatastore', function() {

  it('persists to redis', function(done) {
    var rds = new datastores.RedisDatastore();

    // Fetching with a primary key value that does not exist.
    // rds.fetch('modelType', 'id', 1234)

    var datetime = new Date(2010, 1, 2, 3, 4, 5, 6);
    var date = new Date(2010, 1, 1);

    rds.save('models', 'primary_key', {
      primary_key: 'key',
      integer: 1234,
      string: 'string',
      datetime: datetime,
      date: date
    }, function() {
      rds.fetch('models', 'primary_key', 'key',
        ['integer', 'string', 'datetime', 'date']
      , function(err, result) {
        result.integer.should.equal(1234);
        result.string.should.equal('string');
        result.datetime.getTime().should.equal(datetime.getTime());
        result.date.getTime().should.equal(date.getTime());
        done();
      })
    });
  });
});

xdescribe('CassandraDatastore', function() {

  it('persists to cassandra', function(done) {
    var cds = new datastores.CassandraDatastore();

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
