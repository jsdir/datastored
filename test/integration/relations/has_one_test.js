var async = require('async');
var chai = require('chai');

var datastored = require('../../..');
var shared = require('./shared')
var testUtils = require('../../test_utils');

var expect = chai.expect;

function testHasOneSave(cached) {

  before(function() {
    var prefix = cached ? 'Cached' : 'Uncached';

    this.ParentModel = this.createModel({
      relations: {
        child: {
          type: datastored.relations.HasOne,
          relatedModel: prefix + 'ChildModel',
          joinedProperties: ['foo'],
          link: 'parent',
          cached: cached
        }
      }
    }, prefix + 'ParentModel');

    this.ChildModel = this.createModel({
      relations: {
        parent: {
          type: datastored.relations.HasOne,
          relatedModel: prefix + 'ParentModel',
          cached: cached
        }
      }
    }, prefix + 'ChildModel');

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

  it('should update joined properties for a single parent', function(done) {
    var self = this;
    this.child.set('foo', 'baz').save(function(err) {
      if (err) {return done(err);}
      var parent = self.parent;
      console.log(JSON.stringify(parent.model.orm.datastores, null, 2))
      parent.fetch(['child.foo'], function(err) {
        if (err) {return done(err);}
        console.log(parent.get('child'));
        parent.get('child').get('foo').should.eq('baz');
        done();
      });
    });
  });

  it('should update joined properties for multiple parents', function(done) {
    var reloadInstance = testUtils.reloadInstance;

    var child = this.MultiParentChildModel.create({foo: 'bar'});
    var parent1 = this.ParentModel.create({child: child});
    var parent2 = this.ParentModel.create({child: child});

    async.series([
      function(cb) {parent1.save(cb);},
      function(cb) {parent2.save(cb);},
      function(cb) {child.set('foo', 'baz').save(cb);},
      function(cb) {
        reloadInstance(parent1, ['child.*'], function(err, instance) {
          if (err) {return done(err);}
          instance.get('child').get('foo').should.eq('baz');
        });
      },
      function(cb) {
        reloadInstance(parent2, ['child.*'], function(err, instance) {
          if (err) {return done(err);}
          instance.get('child').get('foo').should.eq('baz');
        });
      }
    ], done);
  });

  it('should allow the child to be unassigned', function(done) {
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

  it('should allow the child to be replaced', function(done) {
    var self = this;
    var child = this.ChildModel.create({foo: 'baz'});
    this.parent.set('child', child).save(function(err) {
      if (err) {return done(err);}
      reloadInstance(self.parent, ['child'], function(err, instance) {
        instance.get('child').getId().should.eq(child.getId())
        done();
      });
    });
  });

  it('should only allow of the type relatedModel', function() {
    // test single declaration
    // test multiple declaration
  });

  /*
  xit('should resolve references when the child is destroyed', function(done) {
    this.childModel.destroy(function(err) {
      var parentModel = this.ParentModel.get('id');
      parentModel.fetch(['joinedModel'], function(err) {
        parentModel.get('joinedModel').should.be.null;
        done();
      });
    });
  });
  */

  // Future: Destroying model updates single parent.
  // Future: Destroying model updates multiple parents.
}

xdescribe('HasOne relation', function() {

  before(function() {
    testUtils.setupOrm.call(this);

    this.ParentModel = this.createModel({
      relations: {
        child: {
          type: datastored.relations.HasOne,
          relatedModel: 'ChildModel',
          joinedProperties: ['foo']
        }
      }
    });

    this.RequiredModel = this.createModel({
      relations: {
        child: {
          type: datastored.relations.HasOne,
          relatedModel: 'ChildModel',
          joinedProperties: ['foo'],
          required: true
        }
      }
    });

    //this.ChildModel = this.createModel({}, 'ChildModel');
  });

  shared.testRelatedModelRequired(datastored.relations.HasOne);

  it('should only allow the type of "relatedModel"', function() {
    var model = this.ParentModel.create();
    (function() {
      model.set('child', model);
    }).should.throw(
      'relation "child" was set with a model of an invalid type'
    );
  });

  it('should check that "joinedProperties" are valid properties', function() {
    var self = this;
    (function() {
      self.createModel({relations: {
        child: {
          type: datastored.relations.HasOne,
          relatedModel: 'ChildModel',
          joinedProperties: ['foo', 'invalid']
        }
      }});
    }).should.throw(
      'relation "child" property "invalid" is not a valid property'
    );
  });

  it('should allow unset targets', function() {
    this.ParentModel.create({foo: 'bar'}).save(function(err) {
      expect(err).not.to.exist;
    });
  });

  it('should validate the required option', function() {
    this.RequiredModel.create({foo: 'bar'}).save(function(err) {
      err.should.deep.eq({child: 'attribute "child" is required'});
    });
  });

  xdescribe('when cached', function() {
    testHasOneSave.call(this, true);
  });

  xdescribe('when not cached', function() {
    testHasOneSave.call(this, false);
  });
});
