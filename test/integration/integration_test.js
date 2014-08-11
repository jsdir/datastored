xdescribe('Model', function() {

  beforeEach(function(cb) {
    this.orm._resetDatastores(cb);
  });

  describe('#save()', function() {

    it('should fail if model errors exist', function(done) {
      var model = this.ErrorModel.create({foo: 'foo'});
      model.save(function(err) {
        err.should.deep.eq({foo: 'message'});
        done();
      });
    });

    it('should callback if no attributes were changed', function(done) {
      var model = Model.create({foo: 'bar'});
      model.save(function(err) {
        if (err) {throw err;}
        model.save(function(err) {
          if (err) {throw err;}
          datastore.save.should.not.have.beenCalled();
        });
      });
    });

    it('should only save changed attributes to the datastores',
      function(done) {
      var model = Model.create({foo: 'bar'});
      model.save(function(err) {
        if (err) {done(err);}
        datastore.save.should.have.been.calledWith();
        model.set('foo', 'baz').save(function(err) {
          if (err) {done(err);}
          datastore.save.should.have.been.calledWith();
        });
      });
    });

    xit('should fail with callback errors', function() {

    });

    xit('should execute all callbacks', function() {

    });

    xit('should validate before saving', function() {

    });

    xit('should generate a model id with "orm.generateId"', function(done) {

    });

    xit('should save a new model to the datastore', function() {
      // spy to make sure that only the change attributes were actually saved.
      // verify with fetch
      // verify that all properties exist
    });

    xit('should save an existing model to the datastore', function() {
      // verify with fetch
      // verify that all properties exist
    });
  });

  xdescribe('#fetch()', function() {

    beforeEach(function(cb) {
      this.orm._resetDatastores(cb);
    });

    it('should fail if model errors exist', function(done) {
      var model = this.ErrorModel.get('foo', true);
      model.set('foo', 'bar');
      model.fetch(function(err) {
        err.should.deep.eq({foo: 'message'});
        done();
      });
    });

    it('should fail if the model\'s primary key property is not set',
      function() {
      var model = this.Model.create({foo: 'bar'});

      (function() {
        model.fetch('scope', function(err) {});
      }).should.throw('the model primary key "id" must be set');
    });

    xit('should select the correct datastores to fetch each attribute from ' +
    'based on the attribute definitions', function() {
    });

    xit('should fail with callback errors', function() {

    });

    xit('should execute all callbacks', function(done) {
      // check user and options
      var Model = orm.createModel({callbacks: {
        beforeFetch: function(options, attributes, cb) {
          options.should.eq('options');
          attributes.should.eq(['attribute']);
          cb(options);
        },
        afterFetch: function(options, values, cb) {
          options.should.eq('options');
          values.should.eq('values');
          cb(options);
        }
      }});

      Model.create({}).save(function(err) {
        if (err) {throw err;}
        model.fetch(done);
        model.fetch('options', done);
        model.fetch([attributes], 'options', done);
      });
    });

    it('should use scopes', function() {

    });
  });

  describe('#find()', function() {

    xit('should mutate the index value by default', function() {

    });

    xit('should not mutate the index value if requested', function() {
      var Model = this.Model;
      (function() {Model.find('foo', 'bar', function() {});})
        .should.throw('attribute "foo" is not an index');
    });
  });

  xdescribe('#destroy()', function() {

    beforeEach(function(cb) {
      this.orm._resetDatastores(cb);
    });

    it('should fail if model errors exist', function(done) {
      var model = this.ErrorModel.get('foo', true);
      model.set('foo', 'bar');
      model.destroy(function(err) {
        err.should.deep.eq({foo: 'message'});
        done();
      });
    });

    it('should fail if the model\'s primary key property is not set',
      function() {
      var model = this.Model.create();

      (function() {
        model.destroy(function() {});
      }).should.throw('the model primary key "id" must be set');
    });

    xit('should delete the model from the datastores', function() {
      // also select the correct datastore(s) to delete from.
    });

    xit('should fail with callback errors', function() {

    });

    xit('should execute all callbacks', function(done) {
      // check user and options
      var Model = orm.createModel({callbacks: {
        beforeDestroy: function(options, cb) {
          options.should.eq('options');
          cb(null, options);
        },
        afterDestroy: function(options, cb) {
          options.should.eq('options');
          cb(null, options);
        }
      }});

      Model.create({}).save(function(err) {
        if (err) {throw err;}
        model.destroy(done);
        model.destroy('options', done);
      });
    });
  });
});

/*
save

  (the following should be tested without options) [m.save(cb)]

  - test saving without specifying a generateId sets an id
  - test saving and fetching a model with all datatypes works with C*.
    - check for new random id (mock generateid)
  - test saving and fetching a model with all datatypes works with redis. (cached)
    - check for new random id (mock generateid)
  - check that saving with any invalid data will not work. (one attribute)
  - check that things can be updated. Have update no set a required variable. should still work.
  - check that saving with unset required variables will not work.

  (use options for the following) [m.save(options, cb)]

  - test beforeSave w/ mixin order (maybe change a value)
  - test save fails when beforeSave fails
  - test afterSave w/ mixin order
  - test save fails when afterSave fails

  - changedAttributes is implicit

incr
  - then save
  - should only work if indexed and type marked as "counter" for now.
  - incr -> save -> incr -> save -> fetch should work.

fetch

  - test beforeFetch w/ mixin order (maybe change a value)
    - test scope
  - test fetch fails when beforeFetch fails
  - test afterFetch w/ mixin order
    - test scope
  - test fetch fails when afterFetch fails

  - test scopes
    - scopename
    - array

  - test saving with variables of mixed cache (default(nocache), cache, cacheOnly)
    and fetch should only use the required datastores to set the correct result

  - test that fetch should change local values and unset changed variables

destroy

  - test beforeDestroy w/ mixin order (maybe change a value)
  - test destroy fails when beforeSave fails
  - test afterDestroy w/ mixin order
  - test destroy fails when afterSave fails
  - test the model is actually destroyed (create -> destroy -> fetch)

Indexing

  - test replace (test that refs are deleted)
  - test no replace (test that refs are kept)
  - test destroy removes both types of indexes.
  - test that changing an attribute will also update an index

find

  - should only find indexes
  - should follow raw param (2 state)
  - should return null if nothing found
  - should return model with id only if found

Multi (?)
 */