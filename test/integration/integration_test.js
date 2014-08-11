var testUtils = require('../utils');

describe('Orm', function() {

  before(function() {
    // Create test orm.
    this.orm = testUtils.createTestOrm();
    this.createModel = testUtils.createModel(this.orm, testUtils.baseOptions);
    this.createNewModel = testUtils.createModel(this.orm);
  });

  before(function() {
    // Define test models.
    this.BasicModel = this.createModel();

    this.ValidatedModel = this.createModel({properties: {
      foo: {type: 'string', rules: {min: 5}},
      bar: {type: 'string', required: true}
    }});
  });

  describe('Model', function() {

    beforeEach(function(cb) {
      this.orm._resetDatastores(cb);
    });

    describe('#save()', function() {

      // Saving without options

      before(function() {
        this.TypeModel = this.createNewModel({
          table: 'table',
          properties: {
            id: {type: 'string', primary: true},

            integer: {type: 'integer'},
            string: {type: 'string'},
            booleanTrue: {type: 'boolean'},
            booleanFalse: {type: 'boolean'},
            datetime: {type: 'datetime'},
            date: {type: 'date'},

            cached_integer: {type: 'integer', cache: true},
            cache_only_integer: {type: 'integer', cacheOnly: true}
          },
          scopes: {
            all: ['id', 'integer', 'string', 'booleanTrue', 'booleanFalse',
              'datetime', 'date', 'cached_integer', 'cache_only_integer']
          }
        });
      });

      it('should use default "orm.generateId"', function(done) {
        var self = this;
        var instance = this.BasicModel.create({foo: 'foo'});
        instance.save(function(err) {
          if (err) {return done(err);}
          instance.getId().should.eq('1');
          done();
        });
      });

      it('should save properties to datastores', function(done) {
        var self = this;
        var datetime = 1264982400000;
        var date = 1264982400000;

        var instance = this.TypeModel.create({
          integer: 123,
          string: 'foobar',
          booleanTrue: true,
          booleanFalse: false,
          datetime: new Date(datetime),
          date: new Date(date),
          cached_integer: 123,
          cache_only_integer: 123
        }, true);

        instance.save(function(err) {
          if (err) {return done(err);}
          var fetchedInstance = self.TypeModel.get(instance.getId());
          fetchedInstance.fetch('all', function(err) {
            if (err) {return done(err);}
            fetchedInstance.getId(true).should.exist;

            // Tests serialization.

            var data = fetchedInstance.toObject('all');
            data.integer.should.equal(123);
            data.string.should.equal('foobar');
            data.booleanTrue.should.equal(true);
            data.booleanFalse.should.equal(false);
            data.datetime.should.equal(datetime);
            data.date.should.equal('2010-02-01');
            data.cached_integer.should.equal(123);
            data.cache_only_integer.should.equal(123);

            var rawData = fetchedInstance.toObject('all', true);
            rawData.integer.should.equal(123);
            rawData.string.should.equal('foobar');
            rawData.booleanTrue.should.equal(true);
            rawData.booleanFalse.should.equal(false);
            rawData.datetime.getTime().should.equal(datetime);
            rawData.date.getTime().should.equal(date);
            rawData.cached_integer.should.equal(123);
            rawData.cache_only_integer.should.equal(123);

            done();
          });
        });
      });

      it('should validate data', function(done) {
        var instance = this.ValidatedModel.create({foo: 123});
        instance.save(function(err) {
          err.should.deep.eq({
            foo: 'attribute "foo" must have a minimum of 5 characters',
            bar: 'attribute "bar" is required'
          });
          done();
        });
      });

      xit('should update values', function(done) {
        var instance = this.Model.create({foo: 'foo', bar: 1});
        async.series([
          instance.save,
          function(cb) {
            instance.set({bar: 2});
            instance.save(cb);
          },
          function(cb) {
            var instance = this.Model.get('mock_id');
            instance.fetch(['bar'], cb)
          },
          function(cb) {
            instance.get('bar').should.eq(2);
          }
        ], done);
      });

      // Saving with options

      /*
      var callbacks = {
        beforeInput: function(values, cb) {
          cb(null, appendValue(values, 'beforeInput'));
        },
        afterInput: function(values, cb) {
          cb(null, appendValue(values, 'afterInput'));
        },
        beforeOutput: function(values) {
          return appendValue(values, 'beforeOutput');
        },
        afterOutput: function(values) {
          return appendValue(values, 'afterOutput');
        }
      };
      var mixin = {callbacks: callbacks}
      this.CallbackModel = this.createModel({mixins: [mixin],
        callbacks: callbacks});
      */

      xit('should fail when a callback fails', function(done) {

      });

      xit('should run callbacks', function() {
        /*
        - test beforeSave w/ mixin order (maybe change a value)
        - test save fails when beforeSave fails
        - test afterSave w/ mixin order
        - test save fails when afterSave fails
         */
      });
    });

    xdescribe('#incr()', function() {

      it('should only increment properties of type counter', function(done) {
        'only properties of type "counter" can be incremented'
      });

      it('should increment values', function(done) {
        // increment three variables at -1 0 1
        // incr save
        // incr save
        // fetch compare
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

      xit('should ? when no model found');

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

    xdescribe('#find()', function() {

      xit('should mutate the index value by default', function(done) {
        Model.create({indexed: 'foo'}).save(cb);
        Model.find('indexed', 'foo', function(err, instance) {
          instance.getId(true).should.eq('foo');
          done();
        });
      });

      xit('should not mutate the index value if requested', function(done) {
        Model.create({indexed: 'foo'}, true).save(cb);
        Model.find('indexed', 'foo', true, function(err, instance) {
          instance.getId(true).should.eq('foo');
          done();
        });
      });

      it('should only work with indexed properties', function(done) {
        (function() {
          Model.find({nonindex: 'foo'}, function() {});
        }).should.throw('attribute "nonindex" is not an index');
      });

      it('should call back with null if nothing is found', function(done) {
        Model.find('indexed', 'bar', function(err, instance) {
          instance.should.be.null;
          done();
        });
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
});
/*

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
