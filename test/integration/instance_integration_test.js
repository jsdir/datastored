xdescribe('Instance (integration)', function() {

  describe('#save()', function() {

    it('should create a new instance', function(done) {
      var instance = Model.create({foo: 'bar'}, true);
      testUtils.saveAndReload(instance, ['foo'], function(err, instance) {
        if (err) {return done(err);}
        instance.get('foo', true).should.eq('bar');
        instance.getId().should.exist;
        // save with all attribute types.
      });
      // test different combinations of datastores as mocks and access them
      // for assertion
    });

    it('should update an existing instance', function() {
      // save, load new model.get
      // save selected attributes
      // reload instance
      // attribute should have changed
    });
  });

  describe('#fetch()', function() {

  });
});
