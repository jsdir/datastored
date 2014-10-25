var _ = require('lodash');
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

    this.MultiTypeParentModel = this.createModel({
      attributes: {
        child: datastored.HasOne([
          'ChildModel', 'OtherModel'
        ], {required: true})
      }
    });

    this.ChildModel = this.createModel('ChildModel');
  });

  it('should check instance type', function() {
    var instance = this.ParentModel.create();
    var child = this.BasicModel.create();
    (function() {
      instance.set({child: child});
    }).should.throw('expected instance with type "ChildModel"');
  });

  it('should check instance type with multiple types', function() {
    var instance = this.MultiTypeParentModel.create();
    var child = this.BasicModel.create();
    var message = 'expected instance with type "ChildModel" or "OtherModel"';
    (function() {
      instance.set({child: child});
    }).should.throw(message);
  });

  it('should check that related models have the same id type', function() {
    var self = this;
    this.createModel('IntegerIdModel', {idType: 'integer'});
    this.createModel('StringIdModel', {idType: 'string'});

    self.createModel({
      attributes: {
        child: datastored.HasOne(['IntegerIdModel', 'StringIdModel'], {})
      }
    });

    var listeners = process.listeners('uncaughtException');
    process.removeAllListeners('uncaughtException');
    process.on('uncaughtException', function(err) {
      err.should.eq('related models must have the same id type');
      process.removeAllListeners('uncaughtException');
      _.each(listeners, function(listener) {
        process.on('uncaughtException', listener);
      });
      done();
    });
  });

  it('should set the child', function() {
    var child = this.ChildModel.create();
    var parent = this.ParentModel.create({child: child}, true);
    parent.get('child', true).should.eq(child);
  });

  it('should guard the relational attribute', function(done) {
    var child = this.ChildModel.create();
    var parent = this.ParentModel.create();
    parent.set({child: child});
    parent.save(function(err) {
      err.should.eq('guarded?');
      done();
    });
  });

  /*
  TODO: test hidden, required
  xit('should validate required', function() {
    // test when set to null
    var instance = this.ParentModel.create({foo: 'bar'});
    instance.save(function(err) {
      err.should.deep.eq({child: 'attribute "child" is not defined'});
    });
  });

  TODO: utils
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
  */
});

xdescribe('HasMany relation', function() {

});

xdescribe('Tree relation', function() {

});
