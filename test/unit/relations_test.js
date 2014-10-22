var datastored = require('../..');
var chai = require('chai');

var testUtils = require('../test_utils');

chai.should();

describe('HasOne relation', function() {

  before(function() {
    testUtils.setupOrm.call(this);
    testUtils.setupTestModels.call(this);

    this.ParentModel = this.createModel({
      attributes: {
        child: datastored.HasOne('ChildModel', {required: true})
      }
    });
  });

  xit('should only allow values to be instances of type "relatedModel"', function() {
    // test undefined model
  });

  it('should validate required', function() {
    // test when set to null
    var instance = this.ParentModel.create({foo: 'bar'});
    instance.save(function(err) {
      err.should.deep.eq({child: 'attribute "child" is not defined'});
    });
  });

  xit('should initialize through #create()', function() {
    var instance = this.ParentModel.create({
      foo: 'bar',
      child: {
        foo: 'bar',
        bar: 'baz'
      }
    });
    instance.get('foo', true).should.eq('bar');
    var child = instance.get('child', true);
    child.get(['foo', 'bar']).should.deep.eq({foo: 'bar', bar: 'baz'});
  });
});

xdescribe('HasMany relation', function() {

});

xdescribe('Tree relation', function() {

});
