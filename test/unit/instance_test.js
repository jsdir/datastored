var testUtils = require('../test_utils')

describe('Instance', function() {

  before(function() {
    testUtils.setupOrm.call(this);
    testUtils.setupTestModels.call(this);
  });

  it('should have "methods" from model options', function() {
    var instance = this.BasicModel.create();
    instance.func().should.deep.eq(instance);
  });
});
