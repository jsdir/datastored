var _ = require('lodash');
var async = require('async');
var chai = require('chai');

var testUtils = require('../test_utils');

var expect = chai.expect;

describe('Model (integration)', function() {

  before(function() {
    testUtils.setupOrm.call(this);
    testUtils.setupTestModels.call(this);
  });

  beforeEach(function(cb) {
    this.orm._resetDatastores(cb);
  });

  describe('#find()', function() {

    before(function() {
      this.IndexedModel = this.createModel({
        properties: {
          indexed: {type: 'string', index: true, cache: true},
          indexed_no_replace: {
            type: 'string', index: true, cache: true, replace: false
          }
        },
        callbacks: {
          beforeInput: function(values, cb) {
            cb(null, testUtils.appendValue(values, 'beforeInput'));
          },
          afterInput: function(values, cb) {
            cb(null, testUtils.appendValue(values, 'afterInput'));
          }
        }
      });
    });

    it('should mutate the index value by default', function(done) {
      var self = this;
      async.waterfall([
        function(cb) {
          var instance = self.IndexedModel.create({indexed: 'foo'});
          instance.save(function(err) {
            if (err) {return cb(err);}
            cb(null, instance.getId());
          });
        },
        function(id, cb) {
          self.IndexedModel.find('indexed', 'foo', function(err, instance) {
            if (err) {return cb(err);}
            instance.should.exist;
            instance.isNew.should.be.false;
            instance.isChanged().should.be.false;
            instance.getId().should.eq(id);
            cb();
          });
        }
      ], done);
    });

    it('should not mutate the index value if requested', function(done) {
      var self = this;
      async.waterfall([
        function(cb) {
          var instance = self.IndexedModel.create({indexed: 'foo'}, true);
          instance.save(function(err) {
            if (err) {return cb(err);}
            cb(null, instance.getId());
          });
        },
        function(id, cb) {
          self.IndexedModel.find('indexed', 'foo', true,
            function(err, instance) {
            if (err) {return cb(err);}
            instance.getId().should.eq(id);
            cb();
          });
        }
      ], done);
    });

    it('should only work with indexed properties', function() {
      var self = this;
      (function() {
        self.BasicModel.find('nonindex', 'foo', function() {});
      }).should.throw('attribute "nonindex" is not an index');
    });

    it('should callback with null if nothing is found', function(done) {
      this.IndexedModel.find('indexed', 'bar', function(err, instance) {
        expect(instance).to.be.null;
        done();
      });
    });

    it('should use old indexes that have not been replaced',
      function(done) {
      var self = this;
      async.waterfall([
        function(cb) {
          var instance = self.IndexedModel.create({indexed_no_replace: 'foo'}, true);
          instance.save(function(err) {
            if (err) {return cb(err);}
            instance.set({indexed_no_replace: 'bar'}, true).save(function(err) {
              if (err) {return cb(err);}
              cb(null, instance.getId());
            });
          });
        },
        function(id, cb) {
          self.IndexedModel.find('indexed_no_replace', 'foo', true,
            function(err, instance) {
            if (err) {return cb(err);}
            instance.getId().should.eq(id);
            cb();
          });
        }
      ], done);
    });

    it('should not use indexes that have been replaced', function(done) {
      var self = this;
      async.waterfall([
        function(cb) {
          var instance = self.IndexedModel.create({indexed: 'foo'}, true);
          instance.save(function(err) {
            if (err) {return cb(err);}
            instance.set({indexed: 'bar'}, true).save(function(err) {
              if (err) {return cb(err);}
              cb(null, instance.getId());
            });
          });
        },
        function(id, cb) {
          self.IndexedModel.find('indexed', 'foo', true,
            function(err, instance) {
            if (err) {return cb(err);}
            expect(instance).to.be.null;
            cb();
          });
        }
      ], done);
    });
  });
});

describe('Instance (integration)', function() {

  before(function() {
    testUtils.setupOrm.call(this);

    // Define test models.
    this.BasicModel = this.createModel();

    this.ValidatedModel = this.createModel({properties: {
      foo: {type: 'string', rules: {min: 5}},
      bar: {type: 'string', required: true}
    }});
  });

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

    it('should update values', function(done) {
      var ValidatedModel = this.ValidatedModel;

      async.waterfall([
        function(cb) {
          var instance = ValidatedModel.create({foo: 'foooo', bar: 'bar'});
          instance.save(function(err) {
            if (err) {return cb(err);}
            instance.set({bar: 'baz'});
            instance.save(function(err) {
              if (err) {return cb(err);}
              cb(null, instance.getId());
            });
          });
        },
        function(id, cb) {
          var instance = ValidatedModel.get(id);
          instance.fetch(['bar'], function(err) {
            if (err) {return cb(err);}
            instance.get('bar').should.eq('baz');
            cb();
          });
        }
      ], done);
    });

    // Saving with options

    it('should run callbacks', function(done) {
      var Model = this.createModel({
        callbacks: {
          beforeSave: function(options, data, cb) {
            options.should.eq('options');
            cb(null, options, data);
          },
          afterSave: function(options, data, cb) {
            options.should.eq('options');
            cb(null, options, data);
          }
        }
      });

      Model.create({foo: 'foo'}).save('options', done);
    });

    it('should fail when "beforeSave" fails', function(done) {
      var Model = this.createModel({callbacks: {
        beforeSave: function(options, data, cb) {
          cb('error', options, data);
        }
      }});

      Model.create({foo: 'foo'}).save('options', function(err) {
        err.should.eq('error');
        done();
      });
    });

    it('should fail when "afterSave" fails', function(done) {
      var Model = this.createModel({callbacks: {
        afterSave: function(options, data, cb) {
          cb('error', options, data);
        }
      }});

      Model.create({foo: 'foo'}).save('options', function(err) {
        err.should.eq('error');
        done();
      });
    });

    xit('should change indexes when the value changes', function() {

    });
  });

  describe('#{incr,decr}()', function() {

    before(function() {
      this.CounterModel = this.createModel({
        properties: {
          integer_count: {type: 'integer', counter: true, cache: true},
          float_count: {type: 'float', counter: true, cache: true},
          rel_count: {type: 'integer', counter: true, cache: true}
        },
        scopes: {all: ['integer_count', 'float_count', 'rel_count']}
      });
    });

    it('should only increment counters', function() {
      var instance = this.BasicModel.create({foo: 'foo'});

      (function() {instance.incr('foo', 1);}).should.throw(
        'only counters can be incremented'
      );
      (function() {instance.decr('foo', 1);}).should.throw(
        'only counters can be decremented'
      );
    });

    it('should increment values', function(done) {
      var self = this;

      async.waterfall([
        function(cb) {
          var instance = self.CounterModel.create({rel_count: 2});
          instance.save(function(err) {
            if (err) {return cb(err);}

            instance.incr('integer_count', 10);
            instance.decr('integer_count', 5);
            instance.incr('rel_count', 10);
            instance.decr('rel_count', 5);
            instance.incr('float_count', 9.0);
            instance.decr('float_count', 1.2);
            instance.save(function(err) {
              if (err) {return cb(err);}
              cb(null, instance.getId());
            });
          });
        },
        function(id, cb) {
          var instance = self.CounterModel.get(id);
          instance.fetch('all', function(err, fetched) {
            if (err) {return cb(err);}
            fetched.should.be.true;
            instance.get([
              'integer_count', 'rel_count', 'float_count'
            ], true).should.deep.eq({
              integer_count: 5,
              rel_count: 7,
              float_count: 7.8
            });
            cb();
          })
        },
      ], done);
    });
  });

  describe('#fetch()', function() {

    before(function() {
      this.ErrorModel = this.createModel({
        properties: {foo: {type: 'string'}},
        callbacks: {
          beforeInput: function(values, cb) {cb({foo: 'message'});}
        }
      });
    });

    it('should fail if the model is not saved', function() {
      var instance = this.BasicModel.create({foo: 'bar'});
      (function() {
        instance.fetch(['foo'], function(err) {});
      }).should.throw('the model must be saved');
    });

    it('should fail when the model is not found', function(done) {
      var instance = this.BasicModel.get('random');
      instance.fetch(['foo'], function(err, success) {
        success.should.be.false;
        done();
      });
    });

    it('should execute all callbacks', function(done) {
      var Model = this.createModel({callbacks: {
        beforeFetch: function(options, attributes, cb) {
          options.should.deep.eq({});
          attributes.should.deep.eq(['foo']);
          cb(null, options, attributes);
        },
        afterFetch: function(options, data, cb) {
          options.should.deep.eq({});
          data.should.deep.eq({foo: 'bar'});
          cb(null, options, data);
        }
      }});

      var model = Model.create({foo: 'bar'});
      model.save(function(err) {
        if (err) {return done(err);}

        model.fetch('foo', function(err) {
          if (err) {return done(err);}
          done();
        });
      });
    });

    it('should execute all callbacks with options', function(done) {
      var Model = this.createModel({callbacks: {
        beforeFetch: function(options, attributes, cb) {
          options.should.eq('options');
          attributes.should.deep.eq(['foo']);
          cb(null, options, attributes);
        },
        afterFetch: function(options, data, cb) {
          options.should.eq('options');
          data.should.deep.eq({foo: 'bar'});
          cb(null, options, data);
        }
      }});

      var model = Model.create({foo: 'bar'});
      model.save(function(err) {
        if (err) {return done(err);}

        model.fetch('options', ['foo'], function(err) {
          if (err) {return done(err);}
          done();
        });
      });
    });

    it('should fail when "beforeFetch" fails', function(done) {
      var Model = this.createModel({callbacks: {
        beforeFetch: function(options, data, cb) {
          cb('error', options, data);
        }
      }});

      var model = Model.create({foo: 'bar'});
      model.save(function(err) {
        if (err) {return done(err);}
        model.fetch(['foo'], function(err) {
          err.should.eq('error');
          done();
        });
      });
    });

    it('should fail when "afterFetch" fails', function(done) {
      var Model = this.createModel({callbacks: {
        afterFetch: function(options, data, cb) {
          cb('error', options, data);
        }
      }});

      var model = Model.create({foo: 'bar'});
      model.save(function(err) {
        if (err) {return done(err);}
        model.fetch(['foo'], function(err) {
          err.should.eq('error');
          done();
        });
      });
    });

    it('should use scopes correctly', function(done) {
      var self = this;
      var instance = this.BasicModel.create({foo: 'foo', bar: 'bar'});
      instance.save(function(err) {
        if (err) {return done(err);}
        var id = instance.getId();
        async.series([
          function(cb) {
            var fetched = self.BasicModel.get(id);
            fetched.fetch(['foo', 'bar'], function(err) {
              if (err) {return cb(err);}
              fetched.get('foo').should.eq('foo');
              fetched.get('bar').should.eq('bar');
              cb();
            });
          },
          function(cb) {
            var fetched = self.BasicModel.get(id);
            fetched.fetch('foo', function(err) {
              if (err) {return cb(err);}
              fetched.get('foo').should.eq('foo');
              expect(fetched.get('bar')).to.be.undefined;
              cb();
            });
          }
        ], done);
      });
    });

    it('should overwrite local changes', function(done) {
      var self = this;
      var instance = this.BasicModel.create({foo: 'foo', bar: 'bar'});
      instance.save(function(err) {
        if (err) {return done(err);}
        var id = instance.getId();
        var fetched = self.BasicModel.get(id);
        fetched.set('foo', 'baz');
        fetched.get('foo').should.eq('baz');
        fetched.fetch('foo', function(err) {
          if (err) {done(err);}
          fetched.get('foo').should.eq('foo');
          done();
        });
      });
    });

    // TODO: It should return a boolean indicating whether the values were
    // found or not.
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

    xit('should delete the model', function() {
      // - test the model is actually destroyed (create -> destroy -> fetch)
    });

    xit('should execute all callbacks', function(done) {
      /*
        - test beforeDestroy w/ mixin order (maybe change a value)
        - test afterDestroy w/ mixin order
       */
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

    xit('should fail when "beforeDestroy" fails', function() {});

    xit('should fail when "afterDestroy" fails', function() {});

    xit('should destroy indexes', function() {

    });

    xit('should destroy indexes that replace', function() {

    });
  });
});
