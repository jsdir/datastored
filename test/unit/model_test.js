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

describe('Model (unit)', function() {

  before(function() {
    var self = this;
    testUtils.setupOrm.call(this);
    testUtils.setupTestModels.call(this);

    this.assertCreateFails = function(options, message, newModel) {
      (function() {
        if (newModel) {
          self.createNewModel(options);
        } else {
          self.createModel(options);
        }
      }).should.throw(message);
    };
  });

  // Test model options

  it('should require a table name', function() {
    this.assertCreateFails({
      properties: {id: {type: 'string', primary: true}}
    }, '"table" is not defined', true);
  });

  it('should get "staticMethods" from options', function() {
    this.MethodModel.foo().should.deep.equal(this.MethodModel);
  });

  // Property validation tests

  it('should require properties to have types', function() {
    this.assertCreateFails({properties: {notype: {}}},
      'property "notype" requires a type');
  });

  //// Primary key validation

  it('should require a primary key property', function() {
    this.assertCreateFails({table: 'models', relations: {
      foo: {primary: true}
    }}, 'no primary key property defined', true);
  });

  it('should not allow multiple primary key properties', function() {
    this.assertCreateFails({properties: {
      otherId: {type: 'string', primary: true}
    }}, 'multiple primary keys defined');
  });

  it('should not allow the primary key property to be hidden', function() {
    this.assertCreateFails({table: 'models', properties: {
      id: {type: 'string', primary: true, hidden: true}
    }}, 'primary key property "id" cannot be hidden', true);
  });

  it('should require the primary key property to be a string or integer',
    function() {
    var self = this;

    function createOptionsWithIdType(type) {
      return {table: 'models', properties: {id: {primary: true, type: type}}};
    }

    // Create valid models.
    this.createNewModel(createOptionsWithIdType('string'));
    this.createNewModel(createOptionsWithIdType('integer'));

    // Create an invalid model.
    this.assertCreateFails(createOptionsWithIdType('date'),
      'primary key property "id" must have string or integer type', true);
  });

  // Temporary

  it('should only allow cached properties to be indexed', function() {
    this.assertCreateFails({properties: {
      foo: {type: 'string', index: true}
    }}, 'only cached properties can be indexed');
  });

  it('should require counters to be cacheOnly', function() {
    this.assertCreateFails({properties: {
      foo: {type: 'integer', counter: true}
    }}, 'only cached properties can have type "counter"');
  });

  // Test initialize callbacks

  it('should run initialization callbacks', function() {
    var beforeSpy = sinon.spy();
    var afterSpy = sinon.spy();
    var callbacks = {
      beforeInitialize: function(options) {
        options.before = this;
        beforeSpy();
        return options;
      },
      afterInitialize: function(options) {
        options.after = this;
        afterSpy();
        return options;
      }
    };
    var mixin = {callbacks: callbacks};
    var Model = this.createModel({mixins: [mixin], callbacks: callbacks});

    Model.options.before.should.eq(Model);
    Model.options.after.should.eq(Model);

    beforeSpy.should.have.been.calledTwice;
    afterSpy.should.have.been.calledTwice;
    afterSpy.should.have.been.calledAfter(beforeSpy);
  });

  // Test methods

  describe('#create()', function() {

    describe('with stub', function() {

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

    it('should set defaults', function() {
      var callbacks = {
        defaults: function(values) {
          values.default_property += ',defaults'
          return values;
        }
      };
      var mixin = {callbacks: callbacks};
      var instance = this.createModel({properties: {
        default_property: {type: 'string', default: 'value'},
        integer_counter: {type: 'integer', counter: true, cache: true},
        float_counter: {type: 'float', counter: true, cache: true}
      }, mixins: [mixin], callbacks: callbacks}).create();
      instance.get('default_property').should.eq('value,defaults,defaults');
      instance.get('integer_counter', true).should.eq(0);
      instance.get('float_counter', true).should.eq(0.0);
    });

    it('should create a new model', function() {
      var instance = this.BasicModel.create({foo: 'bar'});
      instance.isNew.should.be.true;
      instance.isChanged().should.be.false;
    });
  });

  describe('#get()', function() {

    it('should mutate the primary key by default', function() {
      var instance = this.CallbackModel.get('foo');
      var value = 'foo,beforeInput,beforeInput,afterInput,afterInput';
      instance.get('id', true).should.equal(value);
      instance.isNew.should.be.false;
      instance.isChanged().should.be.false;
    });

    it('should not mutate the primary key if requested', function() {
      var instance = this.CallbackModel.get('foo', true);
      instance.get('id', true).should.equal('foo');
      instance.isNew.should.be.false;
      instance.isChanged().should.be.false;
    });
  });

  describe('#find()', function() {

    it('should require the property to be indexed', function() {
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
