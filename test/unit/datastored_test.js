var async = require('async');
var chai = require('chai');

var datastored = require('../..');
var testUtils = require('../test_utils');

chai.should();

describe('datastored', function() {

  describe('#createOrm()', function() {

    before(function() {
      this.env = testUtils.createTestEnv();
    });

    it('should fall back if `generateId` is not defined', function(done) {
      var orm = this.env.orm;

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
});
