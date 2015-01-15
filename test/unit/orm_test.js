var _ = require('lodash');
var chai = require('chai');

var testUtils = require('../test_utils');

chai.should();

describe('orm', function() {

  before(function() {
    this.env = testUtils.createTestEnv();
  });

  describe('#createModel()', function() {

    it('should fail if the model type is already registered', function() {
      var self = this;
      (function() {
        self.env.orm.createModel('BasicUnitModel', {});
      }).should.throw('model "BasicUnitModel" is already defined');
    });
  });
});
