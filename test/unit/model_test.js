var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

var datastored = require('../..');
var Instance = require('../../lib/instance');
var testUtils = require('../test_utils');

chai.should();
chai.use(sinonChai);
var expect = chai.expect;

describe('Model', function() {

  before(function() {testUtils.setupOrm.call(this);});
  before(function() {testUtils.setupTestModels.call(this);});

  function assertFailsWith(context, isNew, options, message) {
    (function() {
      context.createModel(options, null, isNew);
    }).should.throw(message);
  }

  it('should get "staticMethods" from options', function() {
    this.MethodModel.foo().should.deep.equal(this.MethodModel);
  });

  // Validation tests

  it('should require a table name', function() {
    assertFailsWith(this, true, {id: {type: 'string', primary: true}},
      '"table" is not defined');
  });

  it('should require a primary key property', function() {
    assertFailsWith(this, true, {table: 'models', relations: {
      foo: {primary: true}
    }}, 'no primary key property defined');
  });

  it('should not have multiple primary key properties', function() {
    assertFailsWith(this, false, {properties: {
      otherId: {type: 'string', primary: true}
    }}, 'multiple primary keys defined');
  });

  it('should not allow the primary key property to be hidden', function() {
    assertFailsWith(this, false, {table: 'models', properties: {
      id: {type: 'string', primary: true, hidden: true}
    }}, 'primary key property "id" cannot be hidden');
  });

  it('should require the primary key property to have string or integer ' +
    'type', function() {
    var self = this;
    function createModelWithIdType(type) {
      self.createModel({properties: {id: {type: type}}});
    }
    createModelWithIdType('string');
    createModelWithIdType('integer');
    (function() {createModelWithIdType('date');}).should
      .throw('primary key property "id" must have string or integer type');
  });

  it('should not allow properties without types', function() {
    assertFailsWith(this, false, {properties: {typeless: {}}},
      'property "typeless" requires a type');
  });

  // Temporary

  it('should only allow cached properties to be indexed', function() {
    assertFailsWith(this, false, {properties: {
      foo: {type: 'string', index: true}
    }}, 'only cached properties can be indexed');
  });

  it('should only allow cached props to have type counter', function() {
    assertFailsWith(this, false, {properties: {
      foo: {type: 'integer', counter: true}
    }}, 'only cached properties can have type "counter"');
  });

  // Callback test

  it('should run options through the "initialize" callback', function() {
    var spy = sinon.spy();
    var callbacks = {initialize: function(options) {
      options.modelClass = this;
      spy();
      return options;
    }};
    var mixin = {callbacks: callbacks};
    var Model = this.createModel({mixins: [mixin], callbacks: callbacks});
    Model.options.modelClass.should.eq(Model);
    spy.should.have.been.calledTwice();
  });

  describe('#create()', function() {

    before(function() {sinon.stub(Instance.prototype, 'set');});
    after(function() {Instance.prototype.set.restore();});

    it('should use #set() correctly', function() {
      var instance = this.BasicModel.create('attributes');
      instance.set.should.have.been.calledWith('attributes');
      instance.errors.should.deep.eq({});
    });

    it('should use raw #set() correctly', function() {
      var instance = this.BasicModel.create('attributes', true);
      instance.set.should.have.been.calledWith('attributes', true);
      instance.errors.should.deep.eq({});
    });
  });

  describe('#create()', function() {

    it('should set defaults', function() {
      var instance = this.createModel({properties: {
        default_property: {type: 'string', default: 'value'},
        integer_counter: {type: 'integer', counter: true, cache: true},
        float_counter: {type: 'float', counter: true, cache: true}
      }}).create();
      instance.get('default_property').should.eq('value');
      instance.get('integer_counter', true).should.eq(0);
      instance.get('float_counter', true).should.eq(0.0);
    });
  });

  describe('#get()', function() {

    it('should mutate the primary key by default', function() {
      var model = this.CallbackModel.get('foo');
      var value = 'foo,beforeInput,beforeInput,afterInput,afterInput';
      model.get('id', true).should.equal(value);
    });

    it('should not mutate the primary key if requested', function() {
      var model = this.CallbackModel.get('foo', true);
      model.get('id', true).should.equal('foo');
    });
  });

  describe('#find()', function() {

    it('should require the attribute to be an index', function() {
      var self = this;
      // Test undefined attribute.
      (function() {self.BasicModel.find('bar', 'bar', function() {});})
        .should.throw('attribute "bar" is not an index');
      // Test attribute that is not an index.
      (function() {self.BasicModel.find('foo', 'bar', function() {});})
        .should.throw('attribute "foo" is not an index');
    });
  });
});
