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
