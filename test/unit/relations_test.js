var _ = require('lodash-contrib');
var async = require('async');
var chai = require('chai');

var datastored = require('../..');
var testUtils = require('../utils');

var expect = chai.expect;

function testRelatedModelOption(relationType) {

  it('should require a "relatedModel" option', function() {
    var self = this;
    (function() {
      self.createModel({relations: {
        child: {type: relationType}
      }});
    }).should.throw('relation "child" requires a "relatedModel" option');
  });
}

function testCollection(relationType) {

  describe('Collection', function() {

    describe('#add()', function() {

      it('should add a single model to the collection', function() {
        // check invalid type
        // use fetchObjects all to assert
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

describe('HasOne relation', function() {

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

    this.ChildModel = this.createModel({}, 'ChildModel');
  });

  function testHasOneSave(cached) {

    /*before(function() {
      this.MultipleParentsModel = this.createModel({
        relations: {
          parents: {
            type: datastored.relations.HasMany,
            relatedModel: 'ParentModel',
            joinedProperties: 1
          }
        }
      });

      this.HasParentsModel = this.createModel({
        relations: {
          parents: {
            type: datastored.relations.HasMany,
            relatedModel: 'ParentModel'
          }
        }
      }, 'HasParentsModel');
    });*/

    it.only('should update joined properties for a single parent', function(done) {
      var ParentModel = this.ParentModel;
      var child = this.ChildModel.create({foo: 'bar'});
      var parent = ParentModel.create({child: child});
      parent.save(function(err) {
        if (err) {return done(err);}
        var id = parent.getId();

        child.set('foo', 'baz').save(function(err) {
          if (err) {return done(err);}

          var model = ParentModel.get(id);
          model.fetch(['child.foo'], function(err) {
            if (err) {return done(err);}
            model.get('child').get('foo').should.eq('baz');
          });
        });
      });

      // check backlink functionality
    });

    it('should update joined properties for multiple parents', function(done) {

    });

    it('should fetch and save the child', function() {
      // Don't use a link in this test.
      var child = NoLinkChild.create({foo: 'bar'});
      var parent = ParentModel.create({child: child});
      parent.save(function(err) {
        if (err) {return cb(err);}
        var id = parent.getId();

        var model = ParentModel.get(id);
        model.fetch(['child'], function(err) {
          if (err) {return done(err);}
          model.get('child').should.exist;
        })
      });
    });

    xit('should allow the child to be unassigned', function(done) {
      
      setUpThing();

      parentModel.set('joinedModel', null);
      done();
      // check if link also null or undefined?
    });

    xit('should allow the child to be replaced', function(done) {
      setUpThing();

      var child = this.ChildModel.create();
      var parent = this.ParentModel.create({child: child});

      parent.save(function(err) {
        if (err) {return done(err);}

        var id = parent.getId();
        var model = this.ParentModel.get(id);
        model.fetch(['child'], function(err) {
          if (err) {return done(err);}
          model.get('child').getId().should.eq
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
  // Disable uncached for now with error.
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
