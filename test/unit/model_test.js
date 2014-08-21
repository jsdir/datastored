var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

var datastored = require('../..');
var Instance = require('../../lib/model').Instance;
var testUtils = require('../utils');

chai.should();
chai.use(sinonChai);
var expect = chai.expect;

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

    this.MethodModel = this.createModel({
      staticMethods: {foo: function() {return this;}},
      methods: {foo: function() {return this;}}
    });

    this.ErrorModel = this.createModel({
      properties: {foo: {type: 'string'}},
      callbacks: {
        beforeInput: function(values, cb) {cb({foo: 'message'});}
      }
    });

    var callbacks = {
      beforeInput: function(values, cb) {
        cb(null, testUtils.appendValue(values, 'beforeInput'));
      },
      afterInput: function(values, cb) {
        cb(null, testUtils.appendValue(values, 'afterInput'));
      },
      beforeOutput: function(values) {
        return testUtils.appendValue(values, 'beforeOutput');
      },
      afterOutput: function(values) {
        return testUtils.appendValue(values, 'afterOutput');
      }
    };
    var mixin = {callbacks: callbacks}
    this.CallbackModel = this.createModel({mixins: [mixin],
      callbacks: callbacks});
  });

  describe('Model', function() {

    function assertFailsWith(context, isNew, options, message) {
      (function() {
        context.createModel(options, isNew);
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
      }}, 'multiple primary key properties defined: id,otherId');
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
        foo: {type: 'counter'}
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
      spy.should.have.been.calledTwice;
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
        var DefaultsModel = this.createModel({properties: {
          default_property: {type: 'string', default: 'value'},
          integer_counter: {type: 'integer', counter: true, cache: true},
          float_counter: {type: 'float', counter: true, cache: true}
        }});
        var instance = DefaultsModel.create();
        instance.get('default_property').should.eq('value');
        instance.get('integer_counter', true).should.eq(0);
        instance.get('float_counter', true).should.eq(0.0);
      });
    });

    describe('#createWithId()', function() {

      before(function() {sinon.spy(Instance.prototype, 'set');});
      after(function() {Instance.prototype.set.restore();});

      it('should set the id without attributes', function(done) {
        this.BasicModel.createWithId(function(err, instance) {
          instance.getId().should.exist;
          done();
        });
      });

      it('should use #set() correctly', function(done) {
        this.BasicModel.createWithId('attributes', function(err, instance) {
          instance.getId().should.exist;
          instance.set.should.have.been.calledWith('attributes', false);
          instance.errors.should.deep.eq({});
          done();
        });
      });

      it('should use raw #set() correctly', function(done) {
        this.BasicModel.createWithId('attributes', true,
          function(err, instance) {
          instance.getId().should.exist;
          instance.set.should.have.been.calledWith('attributes', true);
          instance.errors.should.deep.eq({});
          done();
        });
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

  describe('Instance', function() {

    it('should get "methods" from options', function() {
      var model = this.MethodModel.create({});
      model.foo().should.deep.equal(model);
    });

    it('should make the primary key property immutable', function() {
      var model1 = this.BasicModel.create();
      model1.set('id', 'foo', true);
      model1.get('id', true).should.eq('foo');

      var model2 = this.BasicModel.get('foo', true);
      model2.set('id', 'bar', true);
      model2.get('id', true).should.eq('foo');
    });

    describe('#get()', function() {

      before(function() {
        this.HiddenModel = this.createModel({properties: {
          password: {type: 'string', hidden: true}
        }});
      });

      it('should mutate attributes by default', function() {
        var model = this.CallbackModel.create({foo: 'bar'}, true);
        var value = 'bar,beforeOutput,beforeOutput,afterOutput,afterOutput';
        model.get('foo').should.deep.eq(value);
      });

      it('should not mutate attributes if requested', function() {
        var model = this.CallbackModel.create({foo: 'bar'}, true);
        model.get('foo', true).should.eq('bar');
      });

      it('should support getting multiple values', function() {
        var model = this.BasicModel.create({foo: 'foo', bar: 'bar'}, true);
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

      before(function() {
        this.ImmutableModel = this.createModel({
          properties: {foo: {type: 'string', immutable: true}}
        });
      });

      it('should mutate attributes by default', function() {
        var model = this.CallbackModel.create();
        model.set({foo: 'bar'});
        var value = 'bar,beforeInput,beforeInput,afterInput,afterInput';
        model.get('foo', true).should.eq(value);
      });

      it('should not mutate attributes if requested', function() {
        var model = this.CallbackModel.create();
        model.set({foo: 'bar'}, true);
        model.get('foo', true).should.eq('bar');
      });

      it('should not set attributes that are not defined', function() {
        var model = this.BasicModel.create();
        model.set({foo: 'bar', baz: 123}, true);
        expect(model.get('foo')).to.eq('bar');
        expect(model.get('baz')).to.be.undefined;
      });

      it('should store errors on mutation error', function() {
        var model = this.ErrorModel.create();
        model.set({foo: 'bar'});
        model.errors.should.deep.eq({'foo': 'message'});
      });

      it('should not change immutable attributes by default', function() {
        var model = this.ImmutableModel.create({foo: 'bar'}, true);
        model.set({foo: 'baz'});
        model.get('foo').should.eq('bar');
      });

      it('should change immutable attributes if requested', function() {
        var model = this.ImmutableModel.create({foo: 'bar'}, true);
        model.set({foo: 'baz'}, true);
        model.get('foo').should.eq('baz');
      });
    });

    describe('#getId()', function() {

      it('should mutate the result by default', function() {
        var model = this.CallbackModel.get('foo', true);
        var value = 'foo,beforeOutput,beforeOutput,afterOutput,afterOutput';
        model.getId().should.eq(value);
      });

      it('should not mutate the result if requested', function() {
        var model = this.CallbackModel.get('foo', true);
        model.getId(true).should.eq('foo');
      });
    });

    describe('#toObject()', function() {

      it('should return data in the correct scope', function() {
        var instance = this.CallbackModel.get('foo', true);
        instance.set({foo: 'foo', bar: 'bar'}, true);

        instance.toObject('foo').should.deep.eq({
          id: 'foo,beforeOutput,beforeOutput,afterOutput,afterOutput',
          foo: 'foo,beforeOutput,beforeOutput,afterOutput,afterOutput'
        });

        instance.toObject(['bar']).should.deep.eq({
          id: 'foo,beforeOutput,beforeOutput,afterOutput,afterOutput',
          bar: 'bar,beforeOutput,beforeOutput,afterOutput,afterOutput'
        });

        instance.toObject('foo', true).should.deep.eq({
          id: 'foo', foo: 'foo'
        });

        instance.toObject(['bar'], true).should.deep.eq({
          id: 'foo', bar: 'bar'
        });
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
    });
  });
});
