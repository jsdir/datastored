var async = require('async');
var chai = require('chai');

var datastored = require('../../..');
var shared = require('./shared');
var testUtils = require('../../test_utils');

var expect = chai.expect;

function testHasOneSave(cached) {

  var prefix = cached ? 'Cached' : 'Uncached';

  before(function() {

    this.ParentModel = this.createModel(prefix + 'ParentModel', {
      relations: {
        child: {
          type: datastored.relations.HasOne,
          relatedModel: prefix + 'ChildModel',
          joinedProperties: ['foo'],
          link: 'parent',
          cached: cached
        }
      }
    });

    this.ChildModel = this.createModel(prefix + 'ChildModel', {
      relations: {
        parent: {
          type: datastored.relations.HasOne,
          relatedModel: prefix + 'ParentModel',
          cached: cached
        }
      }
    });

    /*this.MultiParentModel = this.createModel({
      relations: {
        child: {
          type: datastored.relations.HasOne,
          relatedModel: prefix + 'ChildModel',
          joinedProperties: ['foo'],
          link: 'parents',
          cached: cached
        }
      }
    }, prefix + 'ParentModel');

    this.MultiParentChildModel = this.createModel({
      relations: {
        parents: {
          type: datastored.relations.HasMany,
          relatedModel: prefix + 'ParentModel',
          cached: true
        }
      }
    }, prefix + 'MultiParentChildModel');*/
  });

  beforeEach(function(done) {
    var self = this;
    var child = this.ChildModel.create({foo: 'bar'});
    var parent = this.ParentModel.create({child: child});
    parent.save(function(err) {
      if (err) {return done(err);}
      var id = parent.getId();
      self.child = child;
      self.parent = self.ParentModel.get(id);
      done();
    });
  });

  // Integration tests.

  // - Persistence

  it('should save the child instance', function(done) {
    // beforeEach: saveInstance();
    var parent = this.parent;
    parent.fetch(['child'], function(err, fetched) {
      if (err) {return done(err);}
      fetched.should.be.true;
      parent.isNew.should.be.false;
      parent.isChanged().should.be.false;
      parent.get('child').should.exist;
    });
  });

  // TODO: multitype

  xit('should allow the child to have no link with the parent', function(done) {
    saveInstance();
    // Only check the parent-to-child relationship.
    instance.child.should.be;
  });

  xit('should allow the child to be null', function(done) {
    var self = this;
    var reloadInstance = testUtils.reloadInstance;
    this.parent.set('child', null).save(function(err) {
      if (err) {return done(err);}
      reloadInstance(self.parent, ['child'], function(err, instance) {
        if (err) {return done(err);}
        expect(instance.get('child')).to.be.undefined;
        done();
      });
    });
  });

  xit('should set a changed relation as a changed attribute', function(done) {
    // test .isChanged() true at beginning;
    // test false after save
    // test true after another modification
  });

  // - Links

  it('should update links if the child changed', function() {
    // check multiple parents with one child
    /*
    - a -> null
    - a -> b: a => b, b => a
    - a -> c: a => c, b => null, c => a
    - a -> null: a => null, c => null
    - TODO: destroy
     */
  });

  // - Joined Properties

  it('should save joined properties', function() {
    // save joined props
    // fetch "child" (get all should only return the specified properties)
    // fetch "child.foo" (get all should only return the specified properties)
    // fetch "child.foo", "child.bar", "child.id" (get all should only return the specified properties)
    // fetch "child.*" (get all should only return the specified properties)
  });

  it('should update instance if a joined property is changed', function() {
    // create two parents one child.
    // change prop on child
    // check that parents are changed
  });
}

describe('HasOne relation', function() {

  before(function() {
    testUtils.setupOrm.call(this);

    this.ParentModel = this.createModel('ParentModel', {
      relations: {
        child: {
          type: datastored.relations.HasOne,
          relatedModel: 'ChildModel',
          joinedProperties: ['foo'],
          link: 'parent'
        }
      }
    });

    this.ChildModel = this.createModel('ChildModel', {});

    this.instance = this.ParentModel.create({
      foo: 'bar',
      child: {
        foo: 'bar',
        bar: 'baz'
      }
    });
  });

  shared.testRelatedModelRequired(datastored.relations.HasOne);

  it('should only set instances of type(s) "relatedModel"', function() {
    // Test single related model type.
    var model = this.ParentModel.create();
    (function() {
      model.set('child', model);
    }).should.throw(
      'relation "child" must be set with "null" or an instance of type ' +
      '"ChildModel"'
    );

    // Test multiple related model type.
    var multipleModel = this.createModel({
      relations: {
        child: {
          type: datastored.relations.HasOne,
          relatedModel: ['ChildModel1', 'ChildModel2', 'ChildModel3']
        }
      }
    }).create();
    (function() {
      multipleModel.set('child', model);
    }).should.throw(
      'relation "child" must be set with "null" or an instance of type ' +
      '"ChildModel1", "ChildModel2", or "ChildModel3"'
    );
  });

  it('should require a link if joining properties', function() {
    var self = this;
    (function() {
      self.createModel({
        relations: {
          child: {
            type: datastored.relations.HasOne,
            relatedModel: 'ChildModel',
            joinedProperties: ['foo']
          }
        }
      });
    }).should.throw('relation "child" must have a "link" in order to use ' +
      '"joinedProperties"');
  });

  it('should require a value if requested', function() {
    var Model = this.createModel({
      relations: {
        child: {
          type: datastored.relations.HasOne,
          relatedModel: 'ChildModel',
          joinedProperties: ['foo'],
          link: 'parent',
          required: true
        }
      }
    });

    Model.create({foo: 'bar'}).save(function(err) {
      err.should.deep.eq({child: 'attribute "child" is required'});
    });
  });

  it('should not assign typeless data to a multitype relation', function() {
    var Model = this.createModel({
      relations: {
        child: {
          type: datastored.relations.HasOne,
          relatedModel: ['ChildModel1', 'ChildModel2']
        }
      }
    });
    (function() {
      Model.create({child: {}})
    }).should.throw('Cannot assign typeless data to multitype relation ' +
      '"child". Try including a valid "type" attribute with the data.');
  });

  xdescribe('when cached', function() {
    testHasOneSave.call(this, true);
  });

  xdescribe('when not cached', function() {
    testHasOneSave.call(this, false);
  });

  describe('Model.create()', function() {

    it('should create instances from an object', function() {
      this.instance.get('child').should.exist;
      this.instance.get('child', true).get('foo').should.eq('bar');
    });
  });

  describe('Instance.toObject()', function() {

    beforeEach(function() {
      this.childId = this.instance.get('child', true).getId();
    });

    it('should return the instance id', function() {
      var data = this.instance.toObject(['foo', 'child']);
      data.id.should.exist;
      data.foo.should.eq('bar');
      data.child.should.eq(this.childId);
    });

    it('should return single joined properties', function() {
      var data = this.instance.toObject(['foo', 'child', 'child.foo']);
      data.id.should.exist;
      data.foo.should.eq('bar');
      expect(data.bar).to.not.exist;
      data.child.should.deep.eq({id: this.childId, foo: 'bar'});
    });

    it('should return multiple joined properties', function() {
      var scope = ['foo', 'child', 'child.foo', 'child.bar'];
      var data = this.instance.toObject(scope);
      data.id.should.exist;
      data.foo.should.eq('bar');
      data.child.should.deep.eq({id: this.childId, foo: 'bar', bar: 'baz'});
    });
  });
});
