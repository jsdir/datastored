var _ = require('lodash');
var async = require('async');
var chai = require('chai');

var datastored = require('../..');
var testUtils = require('../test_utils');

chai.should()

var options = {
  redisClient: {script: function() {}},
  cassandraClient: true
};

describe('#createOrm()', function() {

  it('should fail when any required option is not defined', function() {
    (function() {
      datastored.createOrm(_.omit(options, ['redisClient']))
    }).should.throw('"redisClient" is not defined');

    (function() {
      datastored.createOrm(_.omit(options, ['cassandraClient']))
    }).should.throw('"cassandraClient" is not defined');
  });

  it('should use an incrementing id generator if `generateId` is not ' +
    'defined', function(done) {
    var orm = datastored.createOrm(options);

    async.series([
      function(cb) {
        orm.generateId(function(err, id) {
          if (err) {return cb(err);}
          id.should.eq(1);
          cb();
        });
      },
      function(cb) {
        orm.generateId(function(err, id) {
          if (err) {return cb(err);}
          id.should.eq(2);
          cb();
        });
      }
    ], done);
  })
});

describe('orm', function() {

  describe('#createModel()', function() {

    it('should fail if the model type has already been registered',
    function() {
      var orm = testUtils.createTestOrm();
      orm.createModel('Model', testUtils.baseOptions);
      (function() {
        orm.createModel('Model', testUtils.baseOptions);
      }).should.throw('model "Model" is already defined');
    });
  });
});
