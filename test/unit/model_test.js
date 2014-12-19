var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var chaiAsPromised = require('chai-as-promised');

var datastored = require('../..');
var memoryDatastores = require('../../lib/datastores/memory');
var testUtils = require('../test_utils');

var expect = chai.expect;
chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Model', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  beforeEach(function() {
    var Model = this.models.BasicUnitModel;
    this.transforms = testUtils.stubTransforms(this.models.BasicUnitModel);
  });

  afterEach(function() {
    this.transforms.restore();
  });

  describe('options', function() {

    before(function() {
      this.modelOptions = this.options.BasicUnitModel;
    });

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
      var Model = this.models.BasicUnitModel;
      Model.property.should.eq('text');
      Model.staticFunc().should.deep.eq(Model);
    });
  });

  describe('#create', function() {

    it('should create and save an instance', function() {
      var transforms = this.transforms;
      var attributes = ['text', 'defaultFunc', 'default1', 'default2'];
      var Model = this.models.BasicUnitModel;
      return Model
        .create({text: 'a', default1: 'b'})
        .then(function(instance) {
          // Test local data
          instance.get(attributes).should.deep.eq({
            text: 'output(input(a))',
            default1: 'output(input(b))',
            default2: 'output(default2)',
            defaultFunc: 'output(defaultFunc)'
          });

          // Test input transform
          transforms.input.lastCall.thisValue.should.eq(instance);
          transforms.input.should.have.been.calledWithExactly({
            text: 'a', default1: 'b'
          }, sinon.match.falsy);

          // Test save transform
          transforms.save.lastCall.thisValue.should.eq(instance);
          transforms.save.should.have.been.calledWith({
            default1: 'input(b)',
            default2: 'default2',
            defaultFunc: 'defaultFunc',
            text: 'input(a)'
          });

          // Fetch the instance for the next assertion.
          var fetchedInstance = transforms.disabled(function() {
            return Model.withId(instance.id);
          });

          return fetchedInstance.fetch(attributes);
        })
        .then(function(instance) {
          // Test that the values were saved.
          instance.get(attributes).should.deep.eq({
            text: 'output(fetch(save(input(a))))',
            default1: 'output(fetch(save(input(b))))',
            default2: 'output(fetch(save(default2)))',
            defaultFunc: 'output(fetch(save(defaultFunc)))'
          });
        });
    });

    it('should apply user transforms if requested', function() {
      var transforms = this.transforms;
      return this.models.BasicUnitModel
        .create({text: 'a'}, true)
        .then(function(instance) {
          transforms.input.lastCall.thisValue.should.eq(instance);
          transforms.input.should.have.been.calledWithExactly({
            text: 'a'
          }, true);
        });
    });

    it('should only set defined attributes', function() {
      return this.models.BasicUnitModel
        .create({id: 'foo', text: 'a', foobar: 123})
        .then(function(instance) {
          expect(instance.get('text')).to.eq('output(input(a))');
          expect(instance.get('foobar')).to.be.undefined;
          instance.getId().should.not.eq('output(foo)');
        });
    });

    it('should fail if required attributes are not specified', function() {
      return this.models.RequiredModel.create({text: 'a'})
        .catch(function(err) {
          err.should.deep.eq({
            required: 'attribute "required" is required'
          });
        });
    });
  });

  describe('#withId', function() {

    it('should return an instance with the given id', function() {
      var instance = this.models.BasicUnitModel.withId('a');
      instance.getId().should.eq('output(input(a))');
      this.transforms.input.lastCall.thisValue.should.eq(instance);
      this.transforms.input.should.have.been.calledWithExactly({
        id: 'a'
      }, sinon.match.falsy);
    });

    it('should apply user transforms if requested', function() {
      var instance = this.models.BasicUnitModel.withId('a', true);
      instance.getId().should.eq('output(input(a))');
      this.transforms.input.lastCall.thisValue.should.eq(instance);
      this.transforms.input.should.have.been.calledWithExactly({
        id: 'a'
      }, true);
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
          index: 'input(value1)',
          transformIndex: 'input(value2)',
          replaceIndex: 'input(value3)'
        }).then(function(instance) {
          self.instance = instance;
        }).then(done, done);
      });
    });

    beforeEach(function() {
      sinon.stub(this.transforms, 'input', function(data) {
        return testUtils.wrapValues(data, 'input');
      });
    });

    afterEach(function() {
      this.transforms.input.restore();
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

    it('should fail if the query attribute is undefined', function() {
      var Model = this.models.BasicUnitModel;
      (function() {Model.find('undefined', 'a');})
        .should.throw('"undefined" is not defined');
    });

    it('should check that the query attribute is indexed', function() {
      var Model = this.models.BasicUnitModel;
      (function() {Model.find('text', 'a');})
        .should.throw('attribute "text" is not an index');
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
          instance.get('index').should.eq('input(value1)');
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
          instance.get('transformIndex').should.eq('input(value2)');
          instance.saved.should.be.true;
        });
    });

    it('should resolve with `null` if nothing was found', function() {
      return this.IndexedModel.find('index', 'undefined')
        .then(function(instance) {
          expect(instance).to.be.null;
        });
    });

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
