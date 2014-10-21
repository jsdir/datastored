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

  describe('#set()', function() {

    it('should not change the id', function() {
      var instance = this.BasicModel.get('idValue', true);
      instance.set({id: 'foo'});
      instance.getId(true).should.eq('idValue');
    });

    it('should not change guarded attributes', function() {
      var instance = this.BasicModel.create({guarded: 'foo'}, true);
      instance.set({guarded: 'bar'});
      instance.get('guarded', true).should.eq('foo');
    });

    it('should change guarded attributes if requested', function() {
      var instance = this.BasicModel.create({guarded: 'foo'}, true);
      instance.set({guarded: 'bar'}, true);
      instance.get('guarded', true).should.eq('bar');
    });

    // TODO: test transforms
  });

  xdescribe('#get()', function() {

  });
});
