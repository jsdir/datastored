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
      var Model = this.createModel();
      var instance = Model.create('attributes', true);
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

  xdescribe('#find()', function() {
    
  });
});

describe('Instance', function() {

  before(onBefore);

  before(function() {
    this.Model = this.createModel({properties: {
      foo: {type: 'string'},
      bar: {type: 'string'}
    }});

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
  });

  // - scope
  //   - delimit both properties and attributes to fetch.

  // [ ] only changed attributes and relations should be sent to the datastore.
  // [ ] test multiple callback mixin ordering
  // [ ] parse-time errors
  //   - limit primary key to only be type string or integer
  //

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

  // Decide separation between redis and cassandra: There can be overlap,
  // both records can suggest looking in only one datastore instead of two.
});

/*
xdescribe('_Model', function() {

  var options = {
    table: 'models',
    schema: {
      id: {
        primary: true,
        type: 'string'
      }
    }
  };

  beforeEach(function() {
    this.orm = datastored.createOrm({
      redisClient: true,
      cassandraClient: true
    });
    this.redis = this.orm.datastores.redis;
    this.cassandra = this.orm.datastores.cassandra;
  });

  it('should set `methods` and `staticMethods`', function() {
    var ModelClass = this.orm.createModel('Model', _.extend({}, options, {
      methods: {
        getInstanceThis: function() {return this;}
      },
      staticMethods: {
        getStaticThis: function() {return this;}
      }
    }));

    // Test static methods.
    ModelClass.getStaticThis().should.deep.equal(ModelClass);

    // Test instance methods.
    var model = ModelClass.create({});
    model.getInstanceThis().should.deep.equal(model);
  });

  describe('constructor', function() {

    it('should fail when any required option is not defined', function() {
      var orm = this.orm;

      (function() {
        orm.createModel('Model', _.omit(options, ['table']));
      }).should.throw('attribute `table` is not defined');

      (function() {
        orm.createModel('Model', _.omit(options, ['schema']));
      }).should.throw('attribute `schema` is not defined');
    });

    it('should fail if a primary key attribute is not defined', function() {
      var orm = this.orm;

      (function() {
        orm.createModel('Model', _.extend({}, options, {
          schema: {}
        }));
      }).should.throw('a primary key attribute is required');
    });

    it('should fail if multiple primary key attributes are ' +
      'defined', function() {
      var orm = this.orm;

      (function() {
        orm.createModel('Model', {
          table: 'models',
          schema: {
            id1: {primary: true},
            id2: {primary: true}
          }
        });
      }).should.throw('only one primary key attribute can be defined per ' +
        'model');
    });

    it('should fail if an attribute is defined without a type', function() {
      var orm = this.orm;

      (function() {
        orm.createModel('Model', _.extend({}, options, {
          schema: {invalidAttribute: {}}
        }));
      }).should.throw('a primary key attribute is required');
    });
  });

  describe('#Model.create()', function() {

    beforeEach(function() {
      sinon.spy(Model.prototype, 'set');
    });

    afterEach(function() {
      Model.prototype.set.restore();
    });

    it('should initially set the attributes', function() {
      var model = this.orm.createModel('Model', options).create({id: 'foo'});
      model.set.should.have.been.calledWith({id: 'foo'});
    });
  });

  describe('#Model.get()', function() {

    it('should use the primary key attribute', function() {
      var model = this.orm.createModel('Model', options).get('foo');
      model.get('id').should.equal('foo');
    });
  });

  describe('#Model.find()', function() {

    beforeEach(function() {
      this.model = this.orm.createModel('Model', _.merge({}, options, {
        schema: {
          indexed: {
            index: true,
            type: 'string'
          },
          cachedAndIndexed: {
            index: true,
            cache: true,
            type: 'string'
          },
          name: {
            type: 'string'
          }
        }
      }));

      sinon.stub(this.model.prototype, 'transform', function(attributes) {
        _.object(_.map(attributes, function(value, name) {
          return [name, 'transformed'];
        }))
      });
    });

    afterEach(function() {
      this.model.transform.restore();
    });

    it('should only allow indexed attributes in the query', function() {
      var model = this.model;

      (function() {
        model.find({name: 'foo'});
      }).should.throw('attribute `name` is not indexed');

      (function() {
        model.find({id: 'foo'});
      }).should.throw('attribute `id` is not indexed');
    });

    it.only('should transform the query by default', function() {
      sinon.stub(this.model, 'fetchFromDatastores', function(onDatastore) {
        var datastore = sinon.mock({
          find: function(query) {
            query.should.deep.equal({indexed: 'transformed'});
            done();
          }
        });
        onDatastore(datastore);
      });
      this.model.find({indexed: 'foo'});
    });

    it('should not transform the query if requested', function(done) {
      sinon.stub(this.model, 'fetchFromDatastores', function(onDatastore) {
        var datastore = sinon.mock({
          find: function(query) {
            query.should.deep.equal({indexed: 'foo'});
            done();
          }
        });
        onDatastore(datastore);
      });
      this.model.find({indexed: 'foo'}, false);
    });

    it('should use the datastores correctly', function() {
      // Should pass whether or not to use the cache.

      sinon.stub(this.model, 'fetchFromDatastores', function(cb) {
        //
      });

      function noop(pk, options, cb) {cb();}

      beforeEach(function() {
        sinon.stub(this.redis, 'destroy', noop);
        sinon.stub(this.cassandra, 'destroy', noop);
      });

      this.model.fetchFromDatastores.restore();

      sinon.stub(this.model, 'fetchFromDatastores', function(cb) {
        cb('error');
      });

      this.model.find({indexed: 'foo'}, function(err) {
        err.should.equal('error');
        done();
      });

      this.model.fetchFromDatastores.restore();
    });

    it('should callback with `null` if no model was found', function() {

    });

    xit('should find a single model through the datastore', function() {
      // if index attribute is cached: (check redis for the index)
      // if fail, check cassandra
      // if fatal err (return fatal err)
      // else if none returned, return null

      // this.redis.find
      this.model.find({indexed: 'foo'}, function(err, model) {
        // check input transform chain
        model.get('id').should.equal();
      });

      // Check errors.
      this.model.find({indexed: 'foo'}, function(err, model) {
        err.should.equal('error');
      });

      this.model.find({indexed: 'foo'}, false, function(err, model) {
        model.get('id').should.equal();
      });

      // similar to fetch
      // redis first if ()
      // [model options, attribute map] (orm options are already given at init)
      //   should give -> id or null
      // cassandra
      // Check that the pk is set. when datastore returns id, and calls back null
      // if no model was found.
      //
      // datastore access needs different strategies. Each strategy needs to be
      // tested.
    });
  });

  describe('#transform()', function() {

    it('should transform with chains in the right order', function(done) {
      var model = this.orm.createModel('Model', _.extend({}, options, {
        transforms: [{
          input: function(attributes, model) {
            attributes.foo += '1';
            return attributes;
          },
          output: function(attributes, model) {
            attributes.foo += '1';
            return attributes;
          },
          fetch: function(attributes, model) {
            attributes.foo += '1';
            return attributes;
          },
          save: function(attributes, model, cb) {
            attributes.foo += '1';
            cb(null, attributes);
          }
        }, {
          input: function(attributes, model) {
            attributes.foo += '2';
            return attributes;
          },
          output: function(attributes, model) {
            attributes.foo += '2';
            return attributes;
          },
          fetch: function(attributes, model) {
            attributes.foo += '2';
            return attributes;
          },
          save: function(attributes, model, cb) {
            attributes.foo += '2';
            cb(null, attributes);
          }
        }]
      })).create();

      model.transform({foo: '0'}, 'input').foo.should.equal('012');
      model.transform({foo: '0'}, 'output').foo.should.equal('021');
      model.transform({foo: '0'}, 'fetch').foo.should.equal('012');
      model.transform({foo: '0'}, 'save', function(err, attributes) {
        attributes.foo.should.equal('021');
        done();
      });
    });
  });

  describe('#set()', function() {

    beforeEach(function() {
      sinon.stub(Model.prototype, 'transform');
    });

    afterEach(function() {
      Model.prototype.transform.restore();
    });

    it('should accept a single attribute', function() {
      var model = this.orm.createModel('Model', options).create();
      model.set('id', 'foo', false);
      model.get('id').should.equal('foo');
    });

    it('should accept multiple attributes', function() {
      var modelOptions = _.merge({}, options, {schema: {
        foo: {type: 'string'}
      }});
      var model = this.orm.createModel('Model', modelOptions).create();

      model.transform.returns({id: 'transformed', foo: 'transformed'});
      model.set({id: 'foo', foo: 'bar'});
      model.get(['id', 'foo']).should.deep.equal({
        id: 'transformed', foo: 'transformed'
      });
      model.transform.should.have.been.calledWith({
        id: 'foo', foo: 'bar'
      }, 'input');

      model.transform.reset();
      model.set({id: 'foo', foo: 'bar'}, false);
      model.get(['id', 'foo']).should.deep.equal({id: 'foo', foo: 'bar'});
      model.transform.should.not.have.been.called;
    });

    it('should omit attributes that are not defined in the ' +
      'schema', function() {
      var model = this.orm.createModel('Model', options).create();
      model.set({id: 'foo', invalid: 'bar'});
      // Ensure that transform chain does not receive the undefined attribute.
      model.transform.should.have.been.calledWith({id: 'foo'});
    });

    xit('should not change immutable attributes', function() {

    });

    xit('should set `changedAttributes`', function() {

    });
  });

  describe('#get()', function() {

    it('should fail when getting an undefined attribute', function() {
      var orm = this.orm;

      (function() {
        orm.createModel('Model', options).create().get(['id', 'invalid'])
      }).should.throw('invalid attribute `invalid`');
    });
  });

  xdescribe('#show()', function() {

    it('should only return the attributes included in the scope', function() {

    });

    it('should use the output transform chain', function() {

    });

    xit('should hide hidden attributes', function() {

    });
  });

  xdescribe('#save()', function() {

    it('should save changed attributes to both datastores', function() {

    });

    it('should save to cassandra before saving to redis', function() {

    });

    it('should only fail when saving to the cassandra datastore ' +
      'fails', function() {
      // Redis failure should not stop it.
    });

    // - caching
    // - relations
    // - permissions (mixin)

    xit('should validate attributes', function() {

    });

    it('should not fail when no attributes have changed', function(done) {
      this.model.save(function(err) {
        expect(err).to.be.undefined;
        done();
      });
    });

    it('should reset changed attributes when done', function(done) {
      var model = this.model;
      model.set('foo', 'bar');

      model.save(function(err) {
        expect(err).to.be.undefined;
        model.changedAttributes.should.be.empty;
        done();
      });
    });
  });

  xdescribe('#fetch()', function() {

    it('should fail if the primary key attribute is not set', function() {

    });

    // scopes
    // fetch from cache if set
    // when to fail

    it('should fetch the model from', function() {

    });
  });

  describe('#destroy()', function() {

    function noop(pk, options, cb) {cb();}

    beforeEach(function() {
      sinon.stub(this.redis, 'destroy', noop);
      sinon.stub(this.cassandra, 'destroy', noop);
    });

    afterEach(function() {
      this.redis.destroy.restore();
      this.cassandra.destroy.restore();
    });

    xit('should destroy the model from both datastores', function(done) {
      var self = this;
      var model = this.orm.createModel('Model', _.extend({}, options, {
        cachedVariables: true
      })).get('foo');
      model.destroy(function() {
        var testOptions = {schema: {id: {
          primary: true, type: 'string'
        }}, table: 'models'};
        self.redis.destroy.should.have.been.calledWith(
          'foo', testOptions, sinon.match.func);
        self.cassandra.destroy.should.have.been.calledWith(
          'foo', testOptions, sinon.match.func);
        done();
      });
    });

    it('should not attempt to destroy from the redis datastore if all ' +
      'attributes are uncached', function() {
      var self = this;
      var model = this.orm.createModel('Model', options).get('foo');
      model.destroy(function() {
        self.redis.destroy.should.not.have.been.called;
        self.cassandra.destroy.should.have.been.called;
      });
    });

    it('should fail if destroying from any datastore fails', function(done) {
      var self = this;
      this.redis.destroy.restore();
      sinon.stub(this.redis, 'destroy', function(pk, options, cb) {
        cb('error');
      });
      var model = this.orm.createModel('Model', options).get('foo');
      model.destroy(function(err) {
        self.cassandra.destroy.should.not.have.been.called;
        err.should.equal('error');
        done();
      });
    });
  });
});
*/
