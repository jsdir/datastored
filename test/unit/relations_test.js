var _ = require('lodash');
var async = require('async');
var chai = require('chai');

var datastored = require('../..');
var testUtils = require('../test_utils');

var expect = chai.expect;

function testRelatedModelOption(relationType) {

  it('should require a "relatedModel" option', function() {
    var self = this;
    (function() {
      self.createModel({relations: {child: {type: relationType}}});
    }).should.throw('relation "child" requires a "relatedModel" option');
  });
}

function testCollection(relationType) {

  before(function() {
    this.CollectionModel = this.createModel({
      relations: {
        children: {
          type: relationType
        }
      }
    });
  });

  describe('Collection', function() {

    describe('#add()', function() {

      beforeEach(function() {
        this.collectionModel = 1;
        this.children = 1;
      });

      it('should add a single model to the collection', function(done) {
        var model = this.CollectionModel.create({foo: 'bar'});
        var children = model.get('children');
        children.add(model, function(err) {
          if (err) {return done(err);}

          children.fetchObjects('scope', function(err, data) {
            if (err) {return done(err);}
            data.should.deep.eq({id: 'w', foo: 'bar'});
          });
        });
      });

      it('should add multiple models to the collection', function() {
        // check invalid type
        (function() {
          model.set('child', model);
        }).should.throw(
          'relation "child" was set with a model of an invalid type'
        );
        // use fetchObjects all to assert
      });

      it('should only allow the type of "relatedModel"', function(done) {
        var invalidModel = this.ParentModel.create({foo: 'bar'});
        this.children.add(invalidModel, function(err) {
          err.should.eq('a model with invalid type');
          done();
        });
      });
    });

    describe('#fetch()', function() {

      it('should fetch all models by default', function() {
        // only model ids
      });

      it('should use fetch modifiers correctly', function() {

      });

      it('should fetch with scope', function() {

      });
    });

    describe('#fetchObjects', function() {

      it('should fetch all models by default', function() {
        // only model ids
      });

      it('should use fetch modifiers correctly', function() {

      });

      it('should fetch with scope', function() {

      });
    });
  });
}

xdescribe('HasOne relation', function() {

  before(function() {
    testUtils.setupOrm.call(this);
  });

  before(function() {
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

  testRelatedModelOption(datastored.relations.HasOne);

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

  describe('cached', function() {
    testHasOneSave.call(this, true);
  });

  describe('not cached', function() {
    testHasOneSave.call(this, false);
  });
});

xdescribe('HasMany relation', function() {

  testRelatedModelOption(datastored.relations.HasMany);
  testCollection(datastored.relations.HasMany);
});

xdescribe('Tree relation', function() {

  testRelatedModelOption(datastored.relations.Tree);

  it('should require a "parentRelationName" option', function() {
    assertOptionRequired
  });

  it('should require a "childrenRelationName" option', function() {
    assertOptionRequired
  });

  it('should require a "link" option', function() {
    assertOptionRequired
  });

  testCollection(datastored.relations.Tree);

  describe('#fetch()', function() {

    it('should fetch leaves by default', function(done) {
      var children = this.root.get('children');
      this.root.get('children').fetch(['foo'], function(err) {
        if (err) {return done(err);}

      });
    });

    it('should not fetch leaves if requested', function(done) {
      var children = this.root.get('children');
      children.fetch(['foo'], {includeLeaves: false}, function(err, data) {
        if (err) {return done(err);}
      });
    });
  });

  describe('#fetchObjects()', function() {

    it('should fetch leaves by default', function() {

    });

    it('should not fetch leaves if requested', function() {

    });
  });

  it('should fail if adding a child at a level greater than the "maxLevels" ' +
    'option', function() {
    this.grandchild.get('children').add(model, function(err) {
      err.should.deep.eq('too many levels');
    });
  });
});

// TODO:
// - For HasOne relations, test that objects will be transformed into new objects.
// - RelationMixin will add a method that accepts a tree object and converts it
// into saved objects.