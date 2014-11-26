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

var testUtils = require('../test_utils');

xdescribe('HasOne relation (integration)', function() {

  // Persistence

  it('should persist', function(done) {
    var child = this.ChildModel.create({foo: 'bar'});
    var instance = this.ParentModel.create({child: child});
    instance.isChanged().should.be.true;
    testUtils.saveAndReloadInstance(instance, [{name: 'child', joinedAttributes: ['foo', 'bar']}], function(err, instance) {
      if (err) {return done(err);}
      instance.isNew.should.be.false;
      instance.isChanged().should.be.false;

      instance.get('child', true).should.be(model);
      instance.get('child').should.be.string; // id
      instance.toObject(['child']).should.deep.eq({child: 'id'});
      instance.toObject([{name: 'child', joinedAttributes: ['foo', 'bar']}]).should.deep.eq({child: {
        id: 'id',
        foo: 'foo',
        bar: 'bar'
      }});
    });

    // TODO: check backlink
  });

  it('should persist when set to "null"', function() {
    var instance = this.ParentModel.create({child: null});
    testUtils.saveAndReloadInstance(instance, ['child'], function(err, instance) {
      if (err) {return done(err);}
      instance.get('child').should.not.exist;
      instance.isNew.should.be.false;
      instance.isChanged().should.be.false;
    });
  });

  // Test persisting without joined properties
  // Test persisting multitype

  // should persist without backlink (try with 1-time joined properties)
  // - check that backlink does not exist on fetch

  // Link Management

  it('should update parent/child links when a link is created/destroyed', function(done) {
    /*
    - update parent/child refs when a link is created/destroyed
        - a -> null
        - a -> b: a => b, b => a
        - a -> c: a => c, b => null, c => a
        - a -> null: a => null, c => null
     */
  })
});

xdescribe('HasMany relation (integration)', function() {

});

xdescribe('Tree relation (integration)', function() {

});
