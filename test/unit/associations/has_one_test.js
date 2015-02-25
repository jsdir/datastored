var _ = require('lodash');
var RSVP = require('rsvp');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

var datastored = require('../../..');
var testUtils = require('../../test_utils');

var expect = chai.expect;
chai.use(chaiAsPromised);

describe('HasOne', function() {

  before(function() {
    this.env = testUtils.createTestEnv();
    var hashStore = this.env.hashStore;
    var createModel = this.env.createWithAttributes;

    this.ChildModel = createModel('ChildModel', {
      foo: datastored.String({hashStores: [hashStore]}),
      parent: datastored.HasOne({
        hashStores: [hashStore]
      })
    });

    this.ParentModel = createModel('ParentModel', {
      foo: datastored.String({hashStores: [hashStore]}),
      child: datastored.HasOne({
        type: 'ChildModel',
        hashStores: [hashStore]
      }),
      guardedChild: datastored.HasOne({
        type: 'ChildModel', hashStores: [hashStore], guarded: true
      }),
      hiddenChild: datastored.HasOne({
        type: 'ChildModel', hashStores: [hashStore], hidden: true
      }),
      unlinkedChild: datastored.HasOne({
        type: 'ChildModel', hashStores: [hashStore]
      }),
      multiTypeChild: datastored.HasOne({hashStores: [hashStore]})
    });

    this.NoLinkParentModel = createModel('NoLinkParent', {
      foo: datastored.String({hashStores: [hashStore]}),
      child: datastored.HasOne({
        type: 'ChildModel',
        hashStores: [hashStore],
        join: ['foo']
      })
    });

    this.RequiredChildModel = createModel('RequiredChildModel', {
      child: datastored.HasOne({
        type: 'ChildModel',
        required: true,
        hashStores: [hashStore]
      })
    });
  });

  beforeEach(function() {
    return testUtils.createInstances(this, {
      parent: this.ParentModel,
      child: this.ChildModel
    });
  });

  function assertAttrEquals(instance, name, value) {
    return function() {
      return testUtils.cloneInstance(instance).fetch(name)
        .then(function(fetchedValue) {
          if (value) {
            testUtils.assertEqualInstances(value, fetchedValue);
          } else {
            expect(fetchedValue).to.be.undefined;
          }
        });
    };
  }

  function saveAttr(instance, name, value) {
    return function() {
      var data = {};
      data[name] = value;
      return instance.save(data);
    };
  }

  describe('single-type', function() {

    it('should check that the child has the correct type', function() {
      var self = this;
      (function() {self.parent.save({unlinkedChild: self.parent});})
        .should.throw('expected instance to have type "ChildModel"');
    });

    it('should save instances', function() {
      var self = this;
      return this.parent
        .save({child: this.child})
        .then(function(instance) {
          // Test local change.
          instance.get('child').should.eq(self.child);
          return instance;
        })
        .then(testUtils.reloadInstance(['child']))
        .then(function(instance) {
          instance.get('child').id.should.eq(self.child.id);
          instance.get('child', {user: true}).should.eq(self.child.id);
          return instance.save({child: null});
        })
        .then(function(instance) {
          // Test local change.
          expect(instance.get('child')).to.be.null;
          return instance;
        })
        .then(testUtils.reloadInstance(['child']))
        .then(function(instance) {
          expect(instance.get('child')).to.be.undefined;
        });
    });
  });

  describe('multi-type', function() {

    it('should save instances', function() {
      var child = this.child;
      var parent = this.parent;
      var self = this;
      return parent
        .save({multiTypeChild: child})
        .then(function(instance) {
          // Test local change.
          instance.get('multiTypeChild').should.eq(child);
          return instance;
        })
        .then(testUtils.reloadInstance(['multiTypeChild']))
        .then(function(instance) {
          instance.get('multiTypeChild').model.should.eq(child.model);
          instance.get('multiTypeChild').id.should.eq(child.id);
          instance.get('multiTypeChild', {user: true}).should.eq(child.id);
          return instance.save({multiTypeChild: parent});
        })
        .then(function(instance) {
          // Test local change.
          instance.get('multiTypeChild').should.eq(parent);
          return instance;
        })
        .then(testUtils.reloadInstance(['multiTypeChild']))
        .then(function(instance) {
          instance.get('multiTypeChild').model.should.eq(parent.model);
          instance.get('multiTypeChild').id.should.eq(parent.id);
          instance.get('multiTypeChild', {user: true}).should.eq(parent.id);
          return instance.save({multiTypeChild: null});
        })
        .then(function(instance) {
          // Test local change.
          expect(instance.get('multiTypeChild')).to.be.null;
          return instance;
        })
        .then(testUtils.reloadInstance(['multiTypeChild']))
        .then(function(instance) {
          expect(instance.get('multiTypeChild')).to.be.undefined;
        });
    });
  });

  describe('saving a child instance', function() {

    it('should check that the instance is valid', function() {
      var parent = this.parent;
      (function() {parent.save({child: true});})
        .should.throw('HasOne associations can only be set with an instance ' +
          'object, attribute hash, or "null"');
    });

    // Test that the association uses the standard attribute options.

    it('should require the child if requested', function() {
      return this.RequiredChildModel.create()
        .then(testUtils.shouldReject, function(err) {
          err.should.deep.eq({child: 'attribute "child" is required'});
        });
    });

    it('should guard the child if requested', function() {
      var child = this.child;
      return this.parent.save({guardedChild: child})
        .then(function(instance) {
          instance.get('guardedChild').should.eq(child);
          return instance.save({guardedChild: null}, {user: true});
        })
        .then(function(instance) {
          instance.get('guardedChild').should.eq(child);
        });
    });
  });

  describe('links', function() {

    before(function() {
      var createModel = this.env.createWithAttributes;
      var hashStore = this.env.hashStore;
      this.HasOneLinkParent = createModel('HasOneLinkParent', {
        child: datastored.HasOne({
          hashStores: [hashStore],
          join: ['foo'],
          link: 'parent'
        }),
        bar: datastored.String({hashStores: [hashStore]})
      });

      this.HasOneLinkChild = createModel('HasOneLinkChild', {
        parent: datastored.HasOne({
          hashStores: [hashStore],
          join: ['bar']
        }),
        foo: datastored.String({hashStores: [hashStore]})
      });
    });

    beforeEach(function() {
      return testUtils.createInstances(this, {
        parent1: this.HasOneLinkParent,
        parent2: this.HasOneLinkParent,
        child1: this.HasOneLinkChild,
        child2: this.HasOneLinkChild
      });
    });

    it('should sync local changes to target instances', function() {
      var parent = this.parent1;
      var child1 = this.child1;
      var child2 = this.child2;
      return parent.save({child: child1})
        .then(assertAttrEquals(child1, 'parent', parent))
        .then(saveAttr(parent, 'child', child2))
        .then(assertAttrEquals(child1, 'parent', undefined))
        .then(assertAttrEquals(child2, 'parent', parent))
        .then(saveAttr(parent, 'child', null))
        .then(assertAttrEquals(child2, 'parent', undefined));
    });

    it('should sync target changes to local instances', function() {
      var parent1 = this.parent1;
      var parent2 = this.parent2;
      var child = this.child1;
      return child.save({parent: parent1})
        .then(assertAttrEquals(parent1, 'child', child))
        .then(saveAttr(child, 'parent', parent2))
        .then(assertAttrEquals(parent1, 'child', undefined))
        .then(assertAttrEquals(parent2, 'child', child))
        .then(saveAttr(child, 'parent', null))
        .then(assertAttrEquals(parent2, 'child', undefined));
    });

    it('should sync joined attributes', function() {
      var child = this.child1;
      var parent = this.parent1;
      return child.save({foo: '1'})
        .then(saveAttr(parent, 'bar', '2'))
        .then(saveAttr(child, 'parent', parent))
        .then(function() {
          return testUtils.cloneInstance(parent).fetch('child');
        })
        .then(function(childInstance) {
          childInstance.get('foo').should.eq('1');
          return testUtils.cloneInstance(child).fetch('parent');
        })
        .then(function(parentInstance) {
          parentInstance.get('bar').should.eq('2');
        })
        .then(saveAttr(child, 'foo', '3'))
        .then(saveAttr(parent, 'bar', '4'))
        .then(function() {
          return testUtils.cloneInstance(parent).fetch('child');
        })
        .then(function(childInstance) {
          childInstance.get('foo').should.eq('3');
          return testUtils.cloneInstance(child).fetch('parent');
        })
        .then(function(parentInstance) {
          parentInstance.get('bar').should.eq('4');
        });
    });
  });

  describe('joined attributes', function() {

    beforeEach(function() {
      return testUtils.createInstances(this, {
        noLinkParent: this.NoLinkParentModel
      });
    });

    it('should be usable without a link', function() {
      var parent = this.noLinkParent;
      var child = this.child;
      return child.save({foo: '1'})
        .then(saveAttr(parent, 'child', child))
        .then(function() {
          return testUtils.cloneInstance(parent).fetch('child');
        })
        .then(function(childInstance) {
          childInstance.get('foo').should.eq('1');
          return saveAttr(child, 'foo', '2');
        })
        .then(function() {
          return testUtils.cloneInstance(parent).fetch('child');
        })
        .then(function(childInstance) {
          childInstance.get('foo').should.eq('1');
        });
    });
  });

  it('should hide the child if requested', function() {
    var child = this.child;
    return this.parent
      .save({hiddenChild: this.child})
      .then(function(instance) {
        instance.get('hiddenChild').should.eq(child);
        expect(instance.get('hiddenChild', {user: true})).to.be.undefined;
      });
  });
});
