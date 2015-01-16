var _ = require('lodash');
var async = require('async');
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var chaiAsPromised = require('chai-as-promised');

var datastored = require('../..');
var memoryDatastores = require('../../lib/datastores/memory');
var testUtils = require('../test_utils');

var expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('Model', function() {

  before(function() {
    this.env = testUtils.createTestEnv();
    this.modelOptions = _.extend({}, this.env.basicModelOptions, {
      keyspace: 'Model'
    });
  });

  beforeEach(function(done) {
    testUtils.resetTransforms(this.env.basicModelLogMixin);
    this.env.hashStore.reset(done);
  });

  describe('options', function() {

    it('should require attributes', function(done) {
      var options = _.omit(this.modelOptions, 'attributes');
      var message = 'no attributes have been defined';
      this.env.assertCreateFails(options, message, done);
    });

    it('should require an id attribute', function() {
      var options = _.omit(this.modelOptions, 'id');
      this.env.assertCreateFails(options, '"id" is not defined');
    });

    it('should require a keyspace', function() {
      var options = _.omit(this.modelOptions, 'keyspace');
      this.env.assertCreateFails(options, '"keyspace" is not defined');
    });

    it('should fail if an attribute is named "id"', function(done) {
      var options = _.merge({}, this.modelOptions, {attributes: {id: {}}});
      var message = 'attribute name cannot be "id"';
      this.env.assertCreateFails(options, message, done);
    });

    it('should assign "statics"', function() {
      var Model = this.env.BasicModel;
      Model.property.should.eq('text');
      Model.staticFunc().should.deep.eq(Model);
    });
  });

  describe('#create', function() {

    before(function() {
      var hashStore = this.env.hashStore;
      this.RequiredModel = this.env.createWithAttributes({
        required: datastored.String({required: true, hashStores: [hashStore]})
      });
    });

    it('should create and save an instance', function() {
      var transforms = this.env.basicModelLogMixin;
      var attributes = ['text', 'defaultFunc', 'default1', 'default2'];
      return this.env.BasicModelLog
        .create({text: 'a', default1: 'b'})
        .then(function(instance) {
          // Test local data
          instance.get(attributes, {ids: false}).should.deep.eq({
            text: 'm.output(m.input(a))',
            default1: 'm.output(m.input(b))',
            default2: 'm.output(default2)',
            defaultFunc: 'm.output(defaultFunc)'
          });

          // Test input transform
          transforms.input.lastCall.thisValue.should.eq(instance);
          transforms.input.should.have.been.calledWithExactly({
            text: 'a', default1: 'b'
          }, {});

          // Test save transform
          transforms.save.lastCall.thisValue.should.eq(instance);
          transforms.save.should.have.been.calledWithExactly({
            default1: 'm.input(b)',
            default2: 'default2',
            defaultFunc: 'defaultFunc',
            text: 'm.input(a)'
          }, {}, sinon.match.func);

          return instance.fetch([
            'text', 'defaultFunc', 'default1', 'default2'
          ], {reload: true, ids: false});
        })
        .then(function(data) {
          // Test that the values were saved.
          data.should.deep.eq({
            text: 'm.output(m.fetch(m.save(m.input(a))))',
            default1: 'm.output(m.fetch(m.save(m.input(b))))',
            default2: 'm.output(m.fetch(m.save(default2)))',
            defaultFunc: 'm.output(m.fetch(m.save(defaultFunc)))'
          });
        });
    });

    it('should call transforms with options', function() {
      var transforms = this.env.basicModelLogMixin;
      return this.env.BasicModelLog
        .create({text: 'a'}, {user: true})
        .then(function(instance) {
          transforms.input.lastCall.thisValue.should.eq(instance);
          transforms.input.should.have.been.calledWithExactly(
            {text: 'a'}, {user: true});

          transforms.save.lastCall.thisValue.should.eq(instance);
          transforms.save.should.have.been.calledWithExactly({
            default1: "default1",
            default2: "default2",
            defaultFunc: "defaultFunc",
            text: "m.input(a)"
          }, {user: true}, sinon.match.func);
        });
    });

    it('should only set defined attributes', function() {
      return this.env.BasicModelLog
        .create({id: 'foo', text: 'a', foobar: 123})
        .then(function(instance) {
          expect(instance.get('text')).to.eq('m.output(m.input(a))');
          expect(instance.get('foobar')).to.be.undefined;
          instance.getId().should.not.eq('output(foo)');
        });
    });

    it('should fail if required attributes are not specified', function() {
      return this.RequiredModel.create({text: 'a'})
        .then(testUtils.shouldReject, function(err) {
          err.should.deep.eq({
            required: 'attribute "required" is required'
          });
        });
    });
  });

  describe('#withId', function() {

    it('should return an instance with the given id', function() {
      var transforms = this.env.basicModelLogMixin;
      var instance = this.env.BasicModelLog.withId('a');
      instance.getId().should.eq('m.output(m.input(a))');
      transforms.input.lastCall.thisValue.should.eq(instance);
      transforms.input.should.have.been.calledWithExactly({id: 'a'}, {});
    });

    it('should call transforms with options', function() {
      var transforms = this.env.basicModelLogMixin;
      var instance = this.env.BasicModelLog.withId('a', {user: true});
      instance.getId().should.eq('m.output(m.input(a))');
      transforms.input.lastCall.thisValue.should.eq(instance);
      transforms.input.should.have.been.calledWithExactly({
        id: 'a'
      }, {user: true});
    });
  });

  describe('#find', function() {

    before(function() {
      var self = this;
      this.indexStore = new memoryDatastores.MemoryIndexStore();

      // IndexModel

      this.indexTransforms = testUtils.wrapMixin('m');
      this.IndexModel = this.env.orm.createModel('IndexModel', {
        keyspace: 'IndexModel',
        mixins: [this.indexTransforms],
        id: datastored.Id({type: 'string'}),
        attributes: {
          index: datastored.String({
            hashStores: [this.env.hashStore],
            indexStore: this.indexStore
          })
        }
      });

      // IndexesModel

      this.IndexesModel = this.env.createWithAttributes({
        index: datastored.String({
          hashStores: [this.env.hashStore],
          indexStore: this.indexStore
        }),
        replaceIndex: datastored.String({
          hashStores: [this.env.hashStore],
          indexStore: this.indexStore,
          replaceIndex: true
        })
      });
    });

    beforeEach(function(done) {
      testUtils.resetTransforms(this.indexTransforms);
      this.env.hashStore.reset(done);
    });

    beforeEach(function() {
      // Create instances.
      var self = this;
      return testUtils.nextTick(function() {
        return self.IndexModel.create({
          index: '1',
          replaceIndex: '1'
        }).then(function(instance) {
          self.instance = instance;
          self.id = instance.id;
        });
      });
    });

    afterEach(function(done) {
      this.indexStore.reset(done);
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
      var Model = this.env.BasicModel;
      (function() {Model.find('undefined', 'a');})
        .should.throw('"undefined" is not defined');
    });

    it('should check that the query attribute is indexed', function() {
      var Model = this.env.BasicModel;
      (function() {Model.find('text', 'a');})
        .should.throw('attribute "text" is not an index');
    });

    it('should find the instance with the indexed value', function() {
      var self = this;
      var transforms = this.indexTransforms;
      return this.IndexModel.find('index', '1')
        .then(function(instance) {
          transforms.input.lastCall.thisValue.should.eq(instance);
          transforms.input.should.have.been.calledWithExactly(
            {index: '1'}, {});
          instance.id.should.eq(self.id);
          instance.get('index').should.eq('m.output(m.input(1))');
          instance.saved.should.be.true;
        });
    });

    it('should call transforms with options', function() {
      var self = this;
      var transforms = this.indexTransforms;
      return this.IndexModel.find('index', '1', {user: true})
        .then(function(instance) {
          transforms.input.lastCall.thisValue.should.eq(instance);
          transforms.input.should.have.been.calledWithExactly(
            {index: '1'}, {user: true});
          instance.id.should.eq(self.id);
          instance.get('index').should.eq('m.output(m.input(1))');
          instance.saved.should.be.true;
        });
    });

    it('should resolve with `null` if nothing was found', function() {
      return this.IndexModel.find('index', 'undefined')
        .then(function(instance) {
          expect(instance).to.be.null;
        });
    });

    it('should use old indexes that have not been replaced', function() {
      return this.IndexesModel.create({index: '1'})
        .then(function(instance) {
          return instance.save({index: '2'});
        })
        .then(assertExists(this.IndexesModel, 'index', '1'))
        .then(assertExists(this.IndexesModel, 'index', '2'));
    });

    it('should not use indexes that have been replaced', function() {
      return this.IndexesModel.create({index: '1'})
        .then(function(instance) {
          return instance.save({replaceIndex: '2'});
        })
        .then(assertExists(this.IndexesModel, 'replaceIndex', '1', false))
        .then(assertExists(this.IndexesModel, 'replaceIndex', '2'));
    });

    it('should should fail if saving a duplicate index', function() {
      return this.IndexModel.create({index: '1'})
        .should.be.rejectedWith('instance with index already exists');
    });
  });
});
