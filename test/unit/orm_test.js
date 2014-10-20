var _ = require('lodash');
var async = require('async');
var chai = require('chai');

var datastored = require('../..');
var testUtils = require('../test_utils');

chai.should()

describe('#datastored.createOrm()', function() {

  before(function() {
    testUtils.setupOrm.call(this);
  });

  it('should use a stub id generator if `generateId` is not defined',
  function(done) {
    var orm = this.orm;

    async.series([
      function(cb) {
        orm.generateId(3, function(err, id) {
          if (err) {return cb(err);}
          id.should.eq('1;3');
          cb();
        });
      },
      function(cb) {
        orm.generateId('model', function(err, id) {
          if (err) {return cb(err);}
          id.should.eq('2;model');
          cb();
        });
      }
    ], done);
  });
});

describe('#orm.createModel()', function() {

  before(function() {
    testUtils.setupOrm.call(this);
  });

  it('should fail if the model type has already been registered', function() {
    var orm = this.orm;
    orm.createModel('Model', testUtils.baseOptions);
    (function() {
      orm.createModel('Model', testUtils.baseOptions);
    }).should.throw('model "Model" is already defined');
  });
});
