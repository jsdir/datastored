var domain = require('domain');

var _ = require('lodash');
var datastored = require('../..');
var chai = require('chai');

var testUtils = require('../test_utils');

chai.should();
var expect = chai.expect;

describe('HasOne relation', function() {

  before(function() {
    testUtils.setupOrm.call(this);
    testUtils.setupTestModels.call(this);

    this.ParentModel = this.createModel({
      attributes: {
        child: datastored.HasOne('ChildModel', {})
      }
    });

    this.ParentRequireModel = this.createModel({
      attributes: {
        child: datastored.HasOne('ChildModel', {required: true})
      }
    });

    this.ParentGuardedModel = this.createModel({
      attributes: {
        child: datastored.HasOne('ChildModel', {guarded: true})
      }
    });

    this.MultiTypeParentModel = this.createModel({
      attributes: {
        child: datastored.HasOne([
          'ChildModel', 'OtherModel'
        ], {})
      }
    });

    this.ChildModel = this.createModel('ChildModel');
    this.OtherModel = this.createModel('OtherModel');
  });

  it('should check for valid instance object', function() {
    var instance = this.ParentModel.create();
    var child = this.BasicModel.create();

    (function() {
      instance.set({child: true});
    }).should.throw('invalid instance object');
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

  it('should check that related models have the same id type', function(done) {
    var self = this;
    var errDomain = domain.create();
    this.createModel('IntegerIdModel', {idType: 'integer'});
    this.createModel('StringIdModel', {idType: 'string'});

    errDomain.on('error', function(err) {
      err.message.should.eq('related models must have the same id type');
      done();
    });

    errDomain.run(function() {
      self.createModel({
        attributes: {
          child: datastored.HasOne(['IntegerIdModel', 'StringIdModel'], {})
        }
      });
    });
  });

  it('should set the child', function() {
    var child = this.ChildModel.create();
    var parent = this.ParentModel.create({child: child}, true);
    parent.get('child', true).should.eq(child);
  });

  it('should require the child if requested', function(done) {
    var parent = this.ParentRequireModel.create({foo: 'bar'});
    parent.save(function(err) {
      err.should.deep.eq({child: 'attribute "child" is not defined'});
      done();
    });
  });

  it('should guard the relational attribute', function(done) {
    var child = this.ChildModel.create();
    var parent = this.ParentGuardedModel.create();
    parent.set({foo: 'bar', child: child});
    expect(parent.get('child')).to.be.undefined;
    done();
  });

  /*
  TODO: test hidden

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
