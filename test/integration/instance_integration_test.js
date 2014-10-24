var attributes = require('../../lib/attributes');
var memoryDatastores = require('../../lib/datastores/memory');
var testUtils = require('../test_utils');

describe('Instance (integration)', function() {

  before(function() {
    this.memoryHashStore = new memoryDatastores.MemoryHashStore();
    testUtils.setupOrm.call(this);

    this.Model = this.createModel({
      attributes: {
        foo: attributes.String({
          hashStores: [this.memoryHashStore]
        }),
        bar: attributes.Integer({
          hashStores: [this.memoryHashStore]
        })
      }
    });
  });

  beforeEach(function(done) {
    this.memoryHashStore.reset(done);
  });

  describe('#save()', function() {

    it('should create a new instance', function(done) {
      var instance = this.Model.create({foo: 'bar'}, true);
      testUtils.saveAndReload(instance, ['foo'], function(err, instance) {
        if (err) {return done(err);}
        instance.get('foo', true).should.eq('bar');
        instance.getId().should.exist;
        // save with all attribute types.
        done();
      });
      // test different combinations of datastores as mocks and access them
      // for assertion
    });

    xit('should update an existing instance', function() {
      // save, load new model.get
      // save selected attributes
      // reload instance
      // attribute should have changed
    });
  });

  xdescribe('#fetch()', function() {

  });
});
