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
    testUtils.createTestEnv(this);
    this.hashStore = new datastored.MemoryHashStore();

    this.ChildModel = this.createWithAttributes('ChildModel', {
      foo: datastored.String({hashStores: [this.hashStore]})
    });

    this.ParentModel = this.createWithAttributes('ParentModel', {
      foo: datastored.String({hashStores: [this.hashStore]}),
      child: datastored.HasOne({
        type: 'ChildModel', link: 'parent', hashStores: [this.hashStore]
      }),
      guardedChild: datastored.HasOne({
        type: 'ChildModel', hashStores: [this.hashStore], guarded: true
      }),
      hiddenChild: datastored.HasOne({
        type: 'ChildModel', hashStores: [this.hashStore], hidden: true
      }),
      unlinkedChild: datastored.HasOne({
        type: 'ChildModel', hashStores: [this.hashStore]
      }),
      multiTypeChild: datastored.HasOne({hashStores: [this.hashStore]})
    });

    this.RequiredChildModel = this.createWithAttributes('RequiredChildModel', {
      child: datastored.HasOne({
        type: 'ChildModel',
        required: true,
        hashStores: [this.hashStore]
      })
    });
  });

  beforeEach(function() {
    var self = this;
    return this.ChildModel.create({foo: 'bar'})
      .then(function(instance) {self.child = instance;});
  });

  beforeEach(function() {
    var self = this;
    return this.ParentModel.create()
      .then(function(instance) {self.parent = instance;});
  });

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
          instance.get('child', true).should.eq(self.child.id);
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

    it('should save nested instances', function() {
      var child;
      var attributes = {
        foo: true,
        child: {
          foo: true,
          // Undefined attribute
          child2: {foo: true}
        }
      };
      var data = {
        foo: 'bar1',
        child: {foo: 'bar2'}
      };

      return this.ParentModel
        .create(data)
        .then(function(instance) {
          // Test get without user transforms.
          child = instance.get('child');
          instance.get('foo').should.eq('bar1');
          child.get('foo').should.eq('bar2');

          // Test get with user transforms.
          instance.get(attributes, true).should.deep.eq(data);

          return instance;
        })
        .then(testUtils.reloadInstance(['foo', 'child']))
        .then(function(instance) {
          instance.get(['foo', 'child'], true).should.deep.eq({
            foo: 'bar1', child: child.id
          });
          return instance;
        })
        .then(testUtils.reloadInstance(attributes))
        .then(function(instance) {
          instance.get(attributes, true).should.deep.eq(data);
        });
    });
  });

  describe('multi-type', function() {

    it('should save instances', function() {
      var self = this;
      return this.parent
        .save({multiTypeChild: this.child})
        .then(function(instance) {
          // Test local change.
          instance.get('multiTypeChild').should.eq(self.child);
          return instance;
        })
        .then(testUtils.reloadInstance(['multiTypeChild']))
        .then(function(instance) {
          instance.get('multiTypeChild').model.should.eq(self.child.model);
          instance.get('multiTypeChild').id.should.eq(self.child.id);
          instance.get('multiTypeChild', true).should.eq(self.child.id);
          return instance.save({multiTypeChild: self.parent});
        })
        .then(function(instance) {
          // Test local change.
          instance.get('multiTypeChild').should.eq(self.parent);
          return instance;
        })
        .then(testUtils.reloadInstance(['multiTypeChild']))
        .then(function(instance) {
          instance.get('multiTypeChild').model.should.eq(self.parent.model);
          instance.get('multiTypeChild').id.should.eq(self.parent.id);
          instance.get('multiTypeChild', true).should.eq(self.parent.id);
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

    it('should fail to save nested instances', function() {
      var self = this;
      (function() {
        self.parent.save({multiTypeChild: {child: {foo: 'bar'}}})
      }).should.throw('cannot save nested instances in multi-type associations');
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
      return this.RequiredChildModel.create({})
        .then(testUtils.shouldReject, function(err) {
          err.should.deep.eq({child: 'attribute "child" is required'});
        });
    });

    it('should guard the child if requested', function() {
      var self = this;
      return this.ParentModel
        .create({guardedChild: this.child})
        .then(function(instance) {
          instance.get('guardedChild').should.eq(self.child);
          return instance.save({guardedChild: null}, true);
        })
        .then(function(instance) {
          instance.get('guardedChild').should.eq(self.child);
        });
    });

    // Test links

    xit('should update parent/child link', function() {
      return parent
        .save({child: child})
        .then(function() {
          child.get('parent').should.eq(parent) // test local and fetched
          return parent.save({child: other});
        })
        .then(function() {
          child.get('parent').should.eq(null) // test local and fetched
        });
      /*
      - update parent/child refs when a link is created/destroyed
          - a -> null
          - a -> b: a => b, b => a
          - a -> c: a => c, b => null, c => a
          - a -> null: a => null, c => null
       */
    });
  });

  xit('should not sync joined properties if no link exists', function() {
    // save child with set joined properties
    // joined properties should exist on newly fetched parent
    // change and save joined attribute on the child
    // fetch parent, joined property should not have changed
  });

  xit('should sync joined properties if a link exists', function() {
    // save child with set joined properties
    // joined properties should exist on newly fetched parent
    // change and save joined attribute on the child
    // fetch parent, joined property should have changed
    // NOTE: joined properties are access by fetch({foo: 'bar', child: ['joinedProperty']})
  });

  it('should hide the child if requested', function() {
    var self = this;
    return this.ParentModel
      .create({hiddenChild: this.child})
      .then(function(instance) {
        instance.get('hiddenChild').should.eq(self.child);
        expect(instance.get('hiddenChild', true)).to.be.undefined;
      });
  });
});
