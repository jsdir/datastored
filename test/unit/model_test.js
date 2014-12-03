var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var chaiAsPromised = require("chai-as-promised");

var datastored = require('../..');
var memoryDatastores = require('../../lib/datastores/memory');
var testUtils = require('../test_utils');

var expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Model', function() {

  var data = {text: 'a'};

  before(function() {
    testUtils.createTestEnv(this);
    this.Model = this.models.BasicUnitModel;
    this.modelOptions = this.options.BasicUnitModel;
  });

  beforeEach(function() {
    sinon.stub(this.Model._transforms, 'input', function(data, transform) {
      return data;
    });
    sinon.stub(this.Model._transforms, 'save', function(data, cb) {
      cb(null, data);
    });
    this.transforms = this.Model._transforms;
  });

  afterEach(function() {
    this.transforms.input.restore();
    this.transforms.save.restore();
  });

  describe('options', function() {

    it('should require attributes', function(done) {
      var options = _.omit(this.modelOptions, 'attributes');
      this.assertCreateFails(options, 'no attributes have been defined', done);
    });

    it('should require an id attribute', function() {
      var options = _.omit(this.modelOptions, 'id');
      this.assertCreateFails(options, '"id" is not defined');
    });

    it('should require a keyspace', function() {
      var options = _.omit(this.modelOptions, 'keyspace');
      this.assertCreateFails(options, '"keyspace" is not defined');
    });

    it('should fail if an attribute is named "id"', function(done) {
      var options = _.merge({}, this.modelOptions, {attributes: {id: {}}});
      this.assertCreateFails(options, 'attribute name cannot be "id"', done);
    });

    it('should assign "statics"', function() {
      this.Model.property.should.eq('text');
      this.Model.staticFunc().should.deep.eq(this.Model);
    });
  });

  describe('#create', function() {

    it('should create and save an instance', function(done) {
      var transforms = this.transforms;
      return this.Model
        .create({text: 'a'})
        .then(function(instance) {
          instance.get('text').should.eq('a');
          transforms.input.lastCall.thisValue.should.eq(instance);
          transforms.input.should.have.been.calledWithExactly({text: 'a'});
          transforms.save.lastCall.thisValue.should.eq(instance);
          transforms.save.should.have.been.calledWithExactly({text: 'a'});
        });
    });

    it('should apply user transforms if requested', function() {
      var transforms = this.transforms;
      return this.Model
        .create({text: 'a'}, true)
        .then(function(instance) {
          instance.get('text').should.eq('a');
          transforms.input.lastCall.thisValue.should.eq(instance);
          transforms.input.should.have.been.calledWithExactly({text: 'a'}, true);
          transforms.save.lastCall.thisValue.should.eq(instance);
          transforms.save.should.have.been.calledWithExactly({text: 'a'});
        });
    });

    it('should set default values', function() {
      return this.Model
        .create({text: 'a', default1: 'b'})
        .then(function(instance) {
          instance.get('text').should.eq('a');
          instance.get('default1').should.eq('b');
          instance.get('default2').should.eq('default2');
          instance.get('defaultFunc').should.eq('defaultFunc');
        });
    });
  });

  describe('#withId', function() {

    it('should return an instance with the given id', function() {
      var instance = this.Model.withId('a');
      instance.getId().should.eq('a');
      this.transforms.input.lastCall.thisValue.should.eq(instance);
      this.transforms.input.should.have.been.calledWithExactly({id: 'a'});
    });

    it('should apply user transforms if requested', function() {
      var instance = this.Model.withId('a', true);
      instance.getId().should.eq('a');
      this.transforms.input.lastCall.thisValue.should.eq(instance);
      this.transforms.input.should.have.been.calledWithExactly({id: 'a'}, true);
    });
  });

  describe('#find', function() {

    before(function(done) {
      var self = this;
      this.memoryHashStore = new memoryDatastores.MemoryHashStore();
      this.memoryIndexStore = new memoryDatastores.MemoryIndexStore();
      testUtils.createTestEnv(this);
      this.IndexedModel = this.orm.createModel('IndexedModel', {
        keyspace: 'IndexedModel',
        id: datastored.Id({type: 'string'}),
        attributes: {
          index: datastored.String({
            hashStores: [this.memoryHashStore],
            indexStore: self.memoryIndexStore
          }),
          transformIndex: datastored.String({
            hashStores: [this.memoryHashStore],
            indexStore: self.memoryIndexStore
          }),
          replaceIndex: datastored.String({
            hashStores: [this.memoryHashStore],
            indexStore: self.memoryIndexStore,
            replaceIndex: true
          })
        }
      });

      process.nextTick(function() {
        self.transforms = self.IndexedModel._transforms
        self.IndexedModel.create({
          index: 'input;value1',
          transformIndex: 'input;value2',
          replaceIndex: 'input;value3'
        }).then(function(instance) {
          self.instance = instance;
        }).then(done, done);
      });
    });

    beforeEach(function() {
      sinon.stub(this.transforms, 'input', function(data, transform) {
        return _.mapValues(data, function(value) {
          return 'input;' + value;
        });
      });
    });

    afterEach(function() {
      this.transforms.input.restore();
    });

    it('should fail if the query attribute is undefined', function() {
      var Model = this.Model;
      (function() {
        Model.find('undefined', 'a');
      }).should.throw('"undefined" is not defined');
    });

    it('should check that the query attribute is indexed', function() {
      var Model = this.Model;
      (function() {
        Model.find('text', 'a');
      }).should.throw('attribute "text" is not an index');
    });

    it('should find the an instance with the indexed value', function() {
      var transforms = this.transforms;
      return this.IndexedModel.find('index', 'value1')
        .then(function(instance) {
          transforms.input.lastCall.thisValue.should.eq(instance);
          transforms.input.should.have.been.calledWithExactly({
            index: 'value1'
          }, undefined);
          instance.getId().should.exist;
          instance.get('index').should.eq('input;value1');
          instance.saved.should.be.true;
        });
    });

    it('should apply user transforms if requested', function() {
      var transforms = this.transforms;
      return this.IndexedModel.find('transformIndex', 'value2', true)
        .then(function(instance) {
          transforms.input.lastCall.thisValue.should.eq(instance);
          transforms.input.should.have.been.calledWithExactly({
            transformIndex: 'value2'
          }, true);
          instance.getId().should.exist;
          instance.get('transformIndex').should.eq('input;value2');
          instance.saved.should.be.true;
        });
    });

    it('should resolve with `null` if nothing was found', function() {
      return this.IndexedModel.find('index', 'undefined')
        .then(function(instance) {
          expect(instance).to.be.null;
        });
    });

    function assertExists(model, name, value, exists) {
      return function() {
        var promise = model.find(name, value);
        if (exists === false) {
          return promise.should.eventually.be.null;
        } else {
          return promise.should.eventually.exist;
        }
      }
    }

    it('should use old indexes that have not been replaced', function() {
      return this.instance.save({index: 'value2'})
        .then(assertExists(this.IndexedModel, 'index', 'value1'))
        .then(assertExists(this.IndexedModel, 'index', 'value2'));
    });

    it('should not use indexes that have been replaced', function() {
      return this.instance.save({replaceIndex: 'value3'})
        .then(assertExists(this.IndexedModel, 'replaceIndex', 'value2', false))
        .then(assertExists(this.IndexedModel, 'replaceIndex', 'value3'));
    });

    it('should should fail if saving a duplicate index', function() {
      return this.IndexedModel.create({index: 'value1'})
        .should.be.rejectedWith('instance with index already exists');
    });
  });
});

describe('input transform', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  // TODO: handle errors in serialization. return errors directly?

  it('should unserialize data', function() {
    var TypeModel = this.models.TypeModel;
    return TypeModel.create().then(function(instance) {
      var data = TypeModel._transforms.input.call(instance, {
        string: 'a',
        integer: 123,
        boolean: true,
        date: '2000-01-01',
        datetime: '2000-01-01T00:00:00.000Z'
      }, true);

      data.string.should.eq('a');
      data.integer.should.eq(123);
      data.boolean.should.eq(true);
      data.date.getTime().should.eq(946684800000);
      data.datetime.getTime().should.eq(946684800000);
    });
  });

  it('should remove guarded values', function() {
    var Model = this.models.BasicUnitModel;
    return Model.create().then(function(instance) {
      Model._transforms.input.call(instance, {
        guarded: 'guarded',
        text: 'a'
      }).should.deep.eq({text: 'a'});
    });
  });

  it('should apply mixin transforms in the correct order', function() {
    var MixinModel = this.models.MixinModel;
    return MixinModel.create().then(function(instance) {
      MixinModel._transforms.input.call(instance, {text: 'a'})
        .should.deep.eq({text: '1(2(3(4(a))))'})
    });
  });
});
