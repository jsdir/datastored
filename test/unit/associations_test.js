var _ = require('lodash');
var RSVP = require('rsvp');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

var datastored = require('../..');
var testUtils = require('../test_utils');

var expect = chai.expect;
chai.use(chaiAsPromised);

describe('HasOne', function() {

  before(function() {
    testUtils.createTestEnv(this);
    this.hashStore = new datastored.MemoryHashStore();

    /*
    var self = this;
    this.ChildModel = this.createWithAttributes('ChildModel', {
      foo: datastored.String({hashStores: [true]})
    });

    this.ParentModel = this.createWithAttributes('ParentModel', {
      child: datastored.HasOne({type: 'ChildModel'}),
      anyChild: datastored.HasOne({idType: 'string'})
    });

    this.RequiredChildModel = this.createWithAttributes('RequiredChildModel', {
      child: datastored.HasOne({type: 'ChildModel', required: true})
    });

    process.nextTick(function() {
      self.models.BasicUnitModel.create().then(function(instance) {
        self.basicInstance = instance;
        return self.ParentModel.create();
      }).then(function(instance) {
        self.parent = instance;
      }).then(done, done);
    });
    */

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

  xit('should be hidden if requested', function() {
    var self = this;
    return this.RequiredChildModel
      .create({child: this.basicInstance})
      .then(function(instance) {
        instance.get('child').should.eq(self.basicInstance);
        expect(instance.get('child', true)).to.be.undefined;
      });
  });
});

/*

function testAssociation(Association) {

  before(function() {
    this.ParentModel = orm.createModel({
      children: Association()
    });
  });

  beforeEach(function() {
    var self = this;
    return this.ParentModel.create(function(instance) {
      self.parent = instance;
    });
  });

  it('should fetch empty lists', function() {
    return RSVP.all(
      this.parent.get('children').then(function(instances) {
        instances.should.be.empty;
      }),
      this.parent.get('children', true).then(function(instances) {
        instances.should.be.empty;
      })
    );
  });

  describe('adding children', function() {

    it('should check that the child is valid', function() {
      var parent = this.parent;
      (function() {parent.save({child: true});})
        .should.throw('HasOne associations can only be saved with an ' +
          'instance object or "null"');
    });

    it('should check that the child has the correct type', function() {
      var self = this;
      (function() {self.parent.save({child: self.basicInstance});})
        .should.throw('expected instance with type "ChildModel"');
    });

    it('should check that the child has the correct id type', function() {
      var self = this;
      (function() {self.parent.save({anyChild: self.basicInstance});})
        .should.throw('expected instance id type to be "string"');
    });
  });

  it('should update parent/child link', function() {
    // links are not required
    // parent.add child (association has link)
    // child.get(parent) should be parent
    // parent.remove(child)
    // child.get(parent) should be null
  });

  it('should allow multiple types to be added', function() {
    this.parent.save({
      children: {
        add: [this.basicModel, this.basicModel]
      }
    });
  });
}

describe('RedisList', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  testAssociation(datastored.RedisList);

  it('should add children', function() {
    // test single add, and multiple add
    // check that all have been added
    // test by getting last item
  });

  it('should fetch ranges', function() {
    var attributes = {
      foo: true,
      children: {
        range: [10, 20]
      }
    };

    return RSVP.all(
      this.parent.get(attributes).then(function(results) {
        results.should.deep.eq({})
      }),
      this.parent.get(attributes, true).then(function(results) {
        results.should.deep.eq({
          foo: 'bar',
          children: [{

          }, {

          }]
        })
      })
    );
  });
});

describe('RedisSet', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  testAssociation(datastored.RedisSet);

  it('should add children', function() {
    // test single add, and multiple add
    // check that all have been added
    // validate with `has`
  });

  it('should remove children', function() {
    // remove by key
    // validate with `has`
  });

  it('should check membership', function() {
    var parent = this.parent;
    var basicInstance = this.basicInstance;
    return parent
      .get('children', {has: basicInstance})
      .then(function(exists) {
        exists.should.be.false;
        return parent.save({children: {push: basicInstance}});
      })
      .then(function(parent) {
        return parent.get('children', {has: basicInstance});
      })
      .then(function(exists) {
        exists.should.be.true;
      });
  });
});

*/
