function testRelatedModelRequired(relationType) {

  it('should require a "relatedModel" option', function() {
    var self = this;
    (function() {
      self.createModel({relations: {child: {type: relationType}}});
    }).should.throw('relation "child" requires a "relatedModel" option');
  });
}

function testHasMany(relationType) {

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
        // TODO: test single declaration
        // TODO: test multiple declaration
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

module.exports = {
  testRelatedModelRequired: testRelatedModelRequired,
  testHasMany: testHasMany
};
