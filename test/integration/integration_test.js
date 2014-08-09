xdescribe('Model', function() {

  beforeEach(function(cb) {
    this.orm._resetDatastores(cb);
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