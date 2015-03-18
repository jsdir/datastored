var datastored = require('../..');
var testUtils = require('../test_utils');

describe('Enums', function() {

  before(function() {
    this.env = testUtils.createTestEnv();
    this.EnumTestModel = this.env.createWithAttributes('EnumTestModel', {
      enum: datastored.Enum(['foo', 'bar'], {
        hashStores: [this.env.hashStore],
        defaultValue: 'foo'
      })
    });
  });

  beforeEach(function(done) {
    this.env.hashStore.reset(done);
  });

  beforeEach(function() {
    var self = this;
    return this.EnumTestModel.create().then(function(instance) {
      self.instance = instance;
    });
  });

  it('should be default value', function() {
    this.instance.get('enum').should.eq('foo');
  });

  it('should fail when set to an undefined value', function() {
    return this.instance.save({enum: 'baz'})
      .then(testUtils.shouldReject, function(err) {
        err.should.eq('value "baz" not found in Enum enum');
      });
  });

  it('should persist values', function() {
    return this.instance.save({enum: 'bar'})
      .then(function(instance) {
        return testUtils.cloneInstance(instance).fetch('enum');
      })
      .then(function(value) {
        value.should.eq('bar');
      });
  });

  it('should persist values in user mode', function() {
    return this.instance.save({enum: 'bar'}, {user: true})
      .then(function(instance) {
        return testUtils.cloneInstance(instance).fetch('enum');
      })
      .then(function(value) {
        value.should.eq('bar');
      });
  });
});
