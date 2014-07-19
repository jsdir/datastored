var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

var datastored = require('../..');
var Instance = require('../../lib/model').Instance;

chai.should();
chai.use(sinonChai);
var expect = chai.expect;

function createOrm() {
  return datastored.createOrm({
    redisClient: true,
    cassandraClient: true
  });
}

function onBefore() {
  var orm = createOrm();
  this.orm = orm;
  this.createModel = function(options, name) {
    return orm.createModel(name || _.uniqueId(), _.merge({}, {
      column: 'models',
      properties: {
        id: {
          type: 'string',
          primary: true
        }
      }
    }, options));
  };

  this.Model = this.createModel({properties: {
    foo: {type: 'string'},
    bar: {type: 'string'}
  }});

  this.CallbackModel = this.createModel({
    properties: {
      foo: {type: 'string'}
    },
    callbacks: {
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
    }
  }, 'CallbackModel');
}

function appendValue(data, appendedValue) {
  return _.object(_.map(data, function(value, key) {
    return [key, value + ',' + appendedValue]
  }));
}

describe('Model', function() {

  before(onBefore);

  describe('mixins', function() {

    function createMixin(n) {
      return {
        column: 'mixin',
        properties: {
          foo: {type: 'string'}
        },
        callbacks: {
          initialize: function(options) {
            return options;
          },
          beforeOutput: function(values) {
            return values;
          },
          afterOutput: function(values) {
            return values;
          },
          beforeInput: function(values, cb) {
            cb(null, values);
          },
          afterInput: function(values, cb) {
            cb(null, values);
          },
          beforeFetch: function(options, attributes, cb) {
            cb(null, options, attributes);
          },
          afterFetch: function(options, values, cb) {
            cb(null, options, values);
          },
          beforeSave: function(options, values, cb) {
            cb(null, options, values);
          },
          afterSave: function(options, values, cb) {
            cb(null, options, values);
          },
          beforeDestroy: function(options, cb) {
            cb(null, options);
          },
          afterDestroy: function(options, cb) {
            cb(null, options);
          }
        }
      }
    }

    it('should combine correctly', function() {
      var Model = this.createModel({
        mixins: [createMixin(1), createMixin(2)],
        callbacks: {
          initialize: function(options) {
            options.foo = 'bar';
            return options;
          },
          beforeOutput: function(values) {
            return values;
          },
          afterOutput: function(values) {
            return values;
          },
          beforeInput: function(values, cb) {
            cb(null, values);
          },
          afterInput: function(values, cb) {
            cb(null, values);
          },
          beforeFetch: function(options, attributes, cb) {
            cb(null, options, attributes);
          },
          afterFetch: function(options, values, cb) {
            cb(null, options, values);
          },
          beforeSave: function(options, values, cb) {
            cb(null, options, values);
          },
          afterSave: function(options, values, cb) {
            cb(null, options, values);
          },
          beforeDestroy: function(options, cb) {
            cb(null, options);
          },
          afterDestroy: function(options, cb) {
            cb(null, options);
          }
        }
      });

      Model.options.column.should.eq('mixin');
    });
  });

  it('should have "staticMethods" from options', function() {
    var modelClass = this.createModel({
      staticMethods: {foo: function() {return this;}}
    });
    modelClass.foo().should.deep.equal(modelClass);
  });

  it('should require a column name', function() {
    var _this = this;
    (function() {
      _this.orm.createModel('Model', {
        id: {
          type: 'string',
          primary: true
        }
      });
    }).should.throw('"column" is not defined');
  });

  it('should require a primary key property', function() {
    var _this = this;
    (function() {
      _this.orm.createModel('Model', {
        column: 'models',
        relations: {foo: {primary: true}}
      });
    }).should.throw('no primary key property defined');
  });

  it('should not have multiple primary key properties', function() {
    var _this = this;
    (function() {
      _this.createModel({
        properties: {
          otherId: {
            type: 'string',
            primary: true
          }
        }
      });
    }).should.throw('multiple primary key properties defined: id,otherId');
  });

  it('should not allow the primary key property to be hidden', function() {
    var _this = this;
    (function() {
      _this.orm.createModel('Model', {
        column: 'models',
        properties: {
          id: {
            type: 'string',
            primary: true,
            hidden: true
          }
        }
      });
    }).should.throw('primary key property "id" cannot be hidden');
  });

  it('should require the primary key property to have string or integer type',
  function() {
    var _this = this;
    function createModelWithIdType(type) {
      _this.createModel({properties: {id: {type: type}}});
    }
    createModelWithIdType('integer');
    (function() {createModelWithIdType('date');})
      .should.throw('primary key property "id" must have string or integer ' +
        'type');
  });

  it('should not allow properties without types', function() {
    var _this = this;
    (function() {
      _this.createModel({
        properties: {
          typeless: {}
        }
      });
    }).should.throw('property "typeless" requires a type');
  });

  it('should run options through the `initialize` callback', function() {
    var Model = this.createModel({
      callbacks: {
        initialize: function(options) {
          options.foo = this;
          return options;
        }
      }
    });
    Model.options.foo.should.eq(Model);
  });

  describe('#create()', function() {

    before(function() {
      sinon.stub(Instance.prototype, 'set');
    });

    after(function() {
      Instance.prototype.set.restore();
    });

    it('should construct instances correctly', function() {
      var instance = this.Model.create('attributes', true);
      instance.set.should.have.been.calledWith('attributes', true);
      instance.errors.should.deep.eq({});
    });
  });

  describe('#get()', function() {

    it('should mutate the primary key by default', function() {
      var model = this.CallbackModel.get('foo');
      model.get('id', true).should.equal('foo,beforeInput,afterInput');
    });

    it('should not mutate the primary key if requested', function() {
      var model = this.CallbackModel.get('foo', true);
      model.get('id', true).should.equal('foo');
    });
  });

  describe('#find()', function() {

    it('should require the attribute to be an index', function() {
      var Model = this.Model;
      (function() {Model.find('foo', 'bar', function() {});})
        .should.throw('attribute "foo" is not an index');
    });

    xit('should not mutate the index value if requested', function() {
      var Model = this.Model;
      (function() {Model.find('foo', 'bar', function() {});})
        .should.throw('attribute "foo" is not an index');
    });
  });
});

describe('Instance', function() {

  before(onBefore);

  before(function() {
    this.HiddenModel = this.createModel({
      properties: {
        password: {
          type: 'string',
          hidden: true
        }
      }
    });

    this.ErrorModel = this.createModel({
      properties: {
        foo: {type: 'string'}
      },
      callbacks: {
        beforeInput: function(values, cb) {
          cb({foo: 'message'});
        }
      }
    }, 'ErrorModel');
  });

  it('should have "methods" from options', function() {
    var modelClass = this.createModel({
      methods: {foo: function() {return this;}}
    });
    var model = modelClass.create({});
    model.foo().should.deep.equal(model);
  });

  it('should make the primary key property immutable', function() {
    var model1 = this.Model.create();
    model1.set('id', 'foo', true);
    model1.get('id', true).should.eq('foo');

    var model2 = this.Model.get('foo', true);
    model2.set('id', 'bar', true);
    model2.get('id', true).should.eq('foo');
  });

  describe('#get()', function() {
    it('should mutate attributes by default', function() {
      var model = this.CallbackModel.create({foo: 'bar'}, true);
      model.get('foo').should.deep.eq('bar,beforeOutput,afterOutput');
    });

    it('should not mutate attributes if requested', function() {
      var model = this.CallbackModel.create({foo: 'bar'}, true);
      model.get('foo', true).should.eq('bar');
    });

    it('should support getting multiple values', function() {
      var model = this.Model.create({foo: 'foo', bar: 'bar'}, true);
      model.get(['foo', 'bar']).should.deep.eq({foo: 'foo', bar: 'bar'});
    });

    it('should not return hidden attributes by default', function() {
      var model = this.HiddenModel.create({password: 'secret'}, true);
      expect(model.get('password')).to.be.undefined;
    });

    it('should return hidden attributes if requested', function() {
      var model = this.HiddenModel.create({password: 'secret'}, true);
      model.get('password', true).should.eq('secret');
    });
  });

  describe('#set()', function() {
    it('should mutate attributes by default', function() {
      var model = this.CallbackModel.create();
      model.set({foo: 'bar'});
      model.get('foo', true).should.eq('bar,beforeInput,afterInput');
    });

    it('should not mutate attributes if requested', function() {
      var model = this.CallbackModel.create();
      model.set({foo: 'bar'}, true);
      model.get('foo', true).should.eq('bar');
    });

    it('should not set attributes that are not defined', function() {
      var model = this.Model.create();
      model.set({baz: 123}, true);
      expect(model.get('baz')).to.be.undefined;
    });

    it('should store errors and become invalid on mutation error', function() {
      var model = this.ErrorModel.create();
      model.set({foo: 'bar'});
      model.errors.should.deep.eq({'foo': 'message'});
    });
  });

  describe('#getPkValue()', function() {
    it('should mutate the result by default', function() {
      var model = this.CallbackModel.get('foo', true);
      model.getPkValue().should.eq('foo,beforeOutput,afterOutput');
    });

    it('should not mutate the result if requested', function() {
      var model = this.CallbackModel.get('foo', true);
      model.getPkValue(true).should.eq('foo');
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

    xit('should only save changed attributes to the datastores', function() {

    });

    xit('should callback if no attributes were changed', function() {

    });

    xit('should fail with error encountered through beforeSave', function() {

    });

    xit('should execute all callbacks', function() {

    });

    xit('should validate before saving', function() {

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

    // - caches
    //   - anything can be cached except the id
    //   - cache (exclusive)
    //   - cacheOnly (exclusive)
    //
    //   model needs a method that can group attributes by redis, cassandra, or both
    //
    // - partitions (since partitions are abstracted away from the orm, use a spy
    // to test the params sent to datastore.save)
    //     - if no attribute has a partition, the model is treated like normal
    //     - if one attribute has a partition, all of the others have a separate one
    //     - all attributes with the same partition are grouped together
    //     - both properties and relations can be separated into partitions
    //     - id cannot be included
    //     - for best performance, scopes should never overlap more than one partition
    //
    // - partitions:
    //    p_name:
    //      attributes
    //    p2_name:
    //      attributes (must not be duplicated)
    //      leave option testing near the actual test
  });

  describe('#fetch()', function() {

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

    xit('should call the datastores correctly');

    xit('should execute all callbacks');

    xit('should only send changed attributes to the datastore');
  });

  describe('#delete()', function() {

    it('should fail if model errors exist', function(done) {
      var model = this.ErrorModel.get('foo', true);
      model.set('foo', 'bar');
      model.destroy(function(err) {
        err.should.deep.eq({foo: 'message'});
        done();
      });
    });

    xit('should fail if the model\'s primary key property is not set',
    function() {

    });

    xit('should delete the model from the datastores', function() {
      // also select the correct datastore(s) to delete from.
    });

    xit('should execute all callbacks', function() {

    });
  });
});
