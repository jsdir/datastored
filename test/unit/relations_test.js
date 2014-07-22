var datastored = require('../..');

describe('HasOne relation', function() {

  before(function() {
    this.ParentModel = orm.createModel({
      relations: {
        child: {
          type: datastored.relations.HasOne,
          relatedModel: 'JoinedModel'
        }
      }
    });

    this.JoinedModel = orm.createModel({
      properties: {
        joinedProperty: {
          type: 'string'
        },
        property: {
          type: 'string'
        }
      }
    });
  });

  it('should require a `relatedModel` option', function() {
    var _this = this;
    (function() {
      _this.orm.createModel({
        relations: {
          child: {type: datastored.relations.HasOne}
        }
      })
    }).should.throw('relation "relation" requires a "relatedModel" option');
  });

  it('should only allow the type of "relatedModel"', function() {
    var model = Model.create();
    (function() {
      parentModel.set('child', model);
    }).should.throw(
      'relation "child" can only contain a model of type "Child"'
    );
  });

  it('should check that "joinedProperties" are valid properties', function() {
    (function() {relation}).should.throw('relation "relation" property "property" is not a valid property');

    (function() {id}).should.throw('relation "relation" property "property" is not a valid property');
  });

  it('should allow access to joined properties before the model is saved',
    function() {
    parentModel.set('child', childModel);
    parentModel.get('child').should.be.instanceOf(this.ChildModel);
    parentModel.get('child.property').should.be.null;
    parentModel.get('child.joinedProperty').should.eq('foo');
  });

  it('should store joined properties with the parent', function(done) {
    parentModel.set('child', childModel);

    var model = this.ParentModel.get('id');
    model.fetch(['child'], function(err) {
      if (err) {
        return done(err);
      }
      parentModel.get('child').should.be.instanceOf(this.ChildModel);
      parentModel.get('child.property').should.be.null;
      parentModel.get('child.joinedProperty').should.eq('foo');
    });
  });

  it('should be able to use multiple model types', function() {

  });

  it('should update joined properties', function(done) {
    childModel.set('joinedProperty', 'baz').save(function(err) {
      if (err) {
        return done(err);
      }
      var model = this.ParentModel.get('id');
      model.fetch(['child'], function(err) {
        if (err) {
          return done(err);
        }
        parentModel.get('child.joinedProperty').should.eq('baz');
      });
    });
  });

  it('should allow the relationship to be unassigned', function(done) {
    parentModel.set('joinedModel', null);
    done();
  });

  it('should allow the child to be replaced', function() {

  });

  it('should resolve references when the child is destroyed', function(done) {
    this.childModel.destroy(function(err) {
      var parentModel = this.ParentModel.get('id');
      parentModel.fetch(['joinedModel'], function(err) {
        parentModel.get('joinedModel').should.be.null;
        done();
      });
    });
  });

  it('should handle joined attributes that are undefined', function() {
    var childModel = this.ChildModel.create({id: 'id'});
    var parentModel = this.ParentModel.create({child: childModel});
  });

  it('should save children before the parent', function(done) {
    var childModel = this.ChildModel.create({id: 'id'});
    var parentModel = this.ParentModel.create({child: childModel});
    parentModel.save(function(err) {
      if (err) {
        return done(err);
      }
      childSave.should.have.been.calledBefore(parentSave);
      done();
    });
  });

  it('should not save the child if it has not changed', function(done) {
    var childModel = this.ChildModel.create({id: 'id'});
    childModel.save(function(err) {
      if (err) {
        return done(err);
      }
      var parentModel = this.ParentModel.create({child: childModel});
      parentModel.save(function(err) {
        if (err) {
          return done(err);
        }
        childSave.should.not.have.been.called();
        done();
      });
    });
  });
});

xdescribe('HasMany relation', function() {

  it('should require a "relatedModel" option', function() {

  });

  // check relatedModel types error
  // check relatedModel actually can store different types

  it('should require "backrefs" to use "cacheCount"', function() {

  });

  it('should require "relatedName" to use "backrefs"', function() {

  });

  it('should use "relatedName" to use existing relations', function() {
    // check backreference
  });

  it('should use the "capacity" option to limit the collection', function() {
    // check that add before/over the limit deleted the first items
  });

  it('should change counter if a child is added', function() {
    // test deleting items with children. the children should be counted
  });

  it('should change counter if a child is deleted', function() {
    // test deleting items with children. the children should be counted
  });

  it('should save children before the parent', function() {

  });

  it('should not save a child if it has not changed', function() {

  });

  // test that each child has an immutable reference to the parent
  // test Collection.fetch() additional models and the end of the list
  // test dependency resolution children are deleted. changes count as well.
});

xdescribe('Collection', function() {

  describe('#has()', function() {

    it('should indicate if a model is a member', function(done) {
      // functionality and exclusivity only for {Z,SET}
    });
  });

  describe('#limit()', function() {

    it('should limit fetched items', function(done) {

    });
  });

  describe('#reverse()', function() {

    it('should fetch items in reverse', function(done) {

    });
  });

  describe('#count()', function() {

    it('should get the number of models', function(done) {

    });
  });

  describe('#add()', function() {

    it('should add a single model', function() {

    });

    it('should add multiple models', function() {

    });

    it('should change the counter', function() {

    });
  });

  describe('#remove()', function() {

    it('should remove a single model', function() {

    });

    it('should remove multiple models', function() {

    });

    it('should change the counter', function() {

    });
  });
});

xdescribe('Tree relation', function() {
  // test moving?
  // test maxLevels
  // test global cache count
  // test parent's cache count (this is already done by hasmany)
  //
  // test with different storage methods
  //   cachedRefs (linear merkle tree)
  //   dynamicResolve
});
