var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

var datastored = require('../..');
var ModelClass = require('../../lib/model').Model;

chai.should();
chai.use(sinonChai);

describe('Model', function() {

  var options = {
    table: 'models',
    schema: {
      id: {
        primary: true,
        type: 'string'
      }
    }
  };

  before(function() {
    this.createModel = function(modelOptions) {
      modelOptions = modelOptions || {};
      return this.orm.createModel('Model', _.merge(options, modelOptions));
    }
  });

  beforeEach(function() {
    // Stub the datastores.
    this.orm = datastored.createOrm({
      redisClient: true,
      cassandraClient: true
    });
  });

  it('should set `methods` and `staticMethods`', function() {
    var Model = this.createModel({
      methods: {
        getInstanceThis: function() {return this;}
      },
      staticMethods: {
        getStaticThis: function() {return this;}
      }
    });

    // Test static methods.
    Model.getStaticThis().should.deep.equal(Model);

    // Test instance methods.
    var model = Model.create({});
    model.getInstanceThis().should.deep.equal(model);
  });

  describe('constructor', function() {

    it('should fail when any required option is not defined', function() {
      var orm = this.orm;

      (function() {
        orm.createModel('Model', _.omit(options, ['table']));
      }).should.throw('`table` is not defined');

      (function() {
        orm.createModel('Model', _.omit(options, ['schema']));
      }).should.throw('`schema` is not defined');
    });

    it('should fail if a primary key attribute is not defined', function() {
      var orm = this.orm;

      (function() {
        orm.createModel('Model', _.extend(_.clone(options), {
          schema: {}
        }));
      }).should.throw('a primary key attribute is required');
    });

    it('should fail if multiple primary key attributes are defined', function() {
      var orm = this.orm;

      (function() {
        orm.createModel('Model', {
          table: 'models',
          schema: {
            id1: {primary: true},
            id2: {primary: true}
          }
        });
      }).should.throw('only one primary key attribute can be defined per model');
    });

    it('should fail if an attribute is defined without a type', function() {
      var orm = this.orm;

      (function() {
        orm.createModel('Model', _.extend(_.clone(options), {
          schema: {invalidAttribute: {}}
        }));
      }).should.throw('a primary key attribute is required');
    });
  });

  // TODO: test transform order

  describe('#Model.create()', function() {

    beforeEach(function() {
      sinon.spy(ModelClass.prototype, 'set');
    });

    afterEach(function() {
      ModelClass.prototype.set.restore();
    });

    it('should initially set the attributes', function() {
      var model = this.createModel().create({id: 'foo'});
      model.set.should.have.been.called
    });
  });

  describe('#Model.get()', function() {

    it('should use the primary key attribute', function() {
      var model = this.createModel().get('foo');
      model.get('id').should.equal('foo');
    });
  });

  describe('#Model.find()', function() {
    // this.createModel().find()
    it('should only allow indexed attributes in the query', function() {
      // try undefined, nonindex, and primary key attributes
    });

    it('should find a single model through the datastore', function() {
      // similar to fetch
      // redis first if ()
      // [model options, attribute map] (orm options are already given at init)
      //   should give -> id or null
      // cassandra
      // err filter (have a function for this pattern and test the function)
      // Check that the pk is set. when datastore returns id, and calls back null
      // if no model was found.
      //
      // datastore access needs different strategies. Each strategy needs to be
      // tested.
    });
  });

  describe('#set()', function() {

    // Check transform chain here.

    it('should accept a single attribute', function() {
      var model = this.createModel().create();
      model.set('id', 'foo');
      model.get('id').should.equal('foo');
    });

    it('should accept multiple attributes', function() {
      var model = this.createModel({schema: {
        foo: {type: 'string'}
      }}).create();

      model.set({id: 'foo', foo: 'bar'});
      model.get(['id', 'foo']).should.deep.equal({id: 'foo', foo: 'bar'});
    });

    it('should omit attributes that are not defined in the ' +
      'schema', function() {
      var model = this.createModel().create();
      model.set({id: 'foo', invalid: 'bar'});
      // Check transform chain does not receive the undefined attr.
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

  xdescribe('#save()', function() {

    it('should save changed attributes to both datastores', function() {

    });

    it('should save to cassandra before saving to redis', function() {

    });

    it('should only fail when saving to the cassandra datastore ' +
      'fails', function() {
      // Redis failure should not stop it.
    });

    // Complications
    // - caching
    // - relations
    // - permissions (mixin)
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

  xdescribe('#destroy()', function() {

    it('should destroy the model from both datastores', function() {

    });

    it('should not attempt to destroy from the redis datastore if the model is not marked as cached', function() {

    });

    it('should fail if destroying from any datastore fails', function() {

    });
  });
});
