var _ = require('lodash');
var chai = require('chai');

var testUtils = require('../test_utils');

chai.should();

describe('orm', function() {

  before(function() {
    testUtils.setupOrm.call(this);
  });

  describe('#createModel()', function() {

    it('should fail if the model type has already been registered', function() {
      var orm = this.orm;
      orm.createModel('Model', testUtils.baseOptions);
      (function() {
        orm.createModel('Model', testUtils.baseOptions);
      }).should.throw('model "Model" is already defined');
    });
  });
});
