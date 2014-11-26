var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

var datastored = require('../..')
var testUtils = require('../test_utils');

var expect = chai.expect;
chai.should();
chai.use(sinonChai);

describe('Model', function() {

  before(function() {
    testUtils.createTestEnv(this);
    this.Model = this.models.BasicUnitModel;
    this.modelOptions = this.options.BasicUnitModel;
  });

  function assertFind(model, name, value, exists, cb) {
    model.find(name, value, true, function(err, instance) {
      if (err) {return cb(err);}
      if (exists) {
        instance.should.exist;
      } else {
        expect(instance).to.be.null;
      }
      cb();
    });
  }

  /*
  before(function() {
    this.memoryHashStore = new memoryDatastores.MemoryHashStore();
    this.memoryIndexStore = new memoryDatastores.MemoryIndexStore();
    testUtils.setupOrm.call(this);
  });

  beforeEach(function(done) {
    this.memoryHashStore.reset(done);
  });

  beforeEach(function(done) {
    this.memoryIndexStore.reset(done);
  });
  */

  describe.only('options', function() {

    it('should require attributes', function() {
      var options = _.omit(this.modelOptions, 'attributes');
      this.assertCreateFails(options, '"attributes" is not defined');
    });

    it('should require an id attribute', function() {
      var options = _.omit(this.modelOptions, 'id');
      this.assertCreateFails(options, '"id" is not defined');
    });

    it('should require a keyspace', function() {
      var options = _.omit(this.modelOptions, 'keyspace');
      this.assertCreateFails(options, '"keyspace" is not defined');
    });

    it('should fail if an attribute is named "id"', function() {
      var options = _.merge({}, this.modelOptions, {attributes: {id: {}}});
      this.assertCreateFails(options, 'attribute name cannot be "id"');
    });

    it('should assign "statics"', function() {
      this.Model.property.should.eq('text');
      this.Model.staticFunc().should.deep.eq(this.Model);
    });
  });

  describe('#build', function() {

    var data = {text: 'a'};

    beforeEach(function() {
      sinon.stub(this.Model._transforms, 'input', function(data, transform) {
        return data;
      });
      this.input = this.Model._transforms.input;
    });

    afterEach(function() {
      this.input.restore();
    });

    it('should build an instance', function() {
      var instance = this.Model.build(data);
      instance.isNew().should.be.true;
      this.input.should.have.been.calledWith(data); // self instance
      console.log(instance.get('text'))
      instance.get('text').should.eq('a');
    });

    it('should apply user transforms if requested', function() {
      var instance = this.Model.build(data, true);
      instance.isNew().should.be.true;
      this.input.should.have.been.calledWith(instance, data, true);
      instance.get('text').should.eq('a');
    });

    it('should set default values', function() {
      var data = {text: 'a', default1: 'b'};
      var instance = this.Model.build(data);
      this.input.should.have.been.calledWith(instance, data);
      instance.get('text').should.eq('a');
      instance.get('default1').should.eq('b');
      instance.get('default2').should.eq('default2');
      instance.get('defaultFunc').should.eq('defaultFunc');
    });
  });

  describe('#create', function() {

    it('should create and save an instance', function() {
      this.BasicModel
        .create({text: 'a'})
        .then(function(instance) {
          instance.get('text').should.eq('a');
        });
      // set echo stub for _input
      // _input should have been called with {text: 'a'}
      // _save should have been called with
    });

    it('should apply user transforms if requested', function() {
      this.BasicModel
        .create({text: 'a'}, true)
        .then(function(instance) {
          instance.get('text').should.eq('a');
        });
      // set echo stub for _input
      // _input should have been called with {text: 'a'}
      // _save should have been called with
    });
  });

  describe('#withId', function() {

    it('should return an instance with the given id', function() {
      // stub _input with echo
      this.Model.withId('a').getId().should.eq('a');
      this.Instance._input.should.have.been.calledWith({id: 'a'});
    });

    it('should apply user transforms if requested', function() {
      // stub _input with echo
      this.Model.withId('a', true).getId().should.eq('a');
      this.Instance._input.should.have.been.calledWith({id: 'a'}, true);
    });
  });

  describe('#find', function() {

    before(function() {
      this.IndexedModel = this.createModel({
        mixins: [testUtils.TransformMixin],
        attributes: {
          index: attributes.String({
            indexStore: this.memoryIndexStore,
            hashStores: [this.memoryHashStore]
          }),
          replaceIndex: attributes.String({
            indexStore: this.memoryIndexStore,
            hashStores: [this.memoryHashStore],
            replaceIndex: true
          })
        }
      });
    });

    beforeEach(function(done) {
      this.instance = this.IndexedModel.create({
        index: 'foo', replaceIndex: 'foo1'
      }, true);
      this.instance.save(done);
    });

    beforeEach(function(done) {
      this.IndexedModel.create({index: 'transformed'}).save(done);
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

    //

    it('should transform the index value by default', function(done) {
      this.IndexedModel.find('index', 'transformed', function(err, instance) {
        if (err) {return done(err);}
        instance.getId(true).should.exist;
        instance.get('index', true).should.eq('input(transformed)');
        instance.isNew.should.be.false;
        instance.isChanged().should.be.false;
        done();
      });
    });

    it('should not transform the index value if requested', function(done) {
      this.IndexedModel.find('index', 'foo', true, function(err, instance) {
        if (err) {return done(err);}
        instance.getId(true).should.exist;
        instance.get('index', true).should.eq('foo');
        instance.isNew.should.be.false;
        instance.isChanged().should.be.false;
        done();
      });
    });

    it('should callback with `null` if nothing was found', function(done) {
      this.IndexedModel.find('index', 'undefined', function(err, instance) {
        if (err) {return done(err);}
        expect(instance).to.be.null;
        done();
      });
    });

    it('should use old indexes that have not been replaced', function(done) {
      var model = this.IndexedModel;
      var instance = this.instance;
      async.series([
        function(cb) {instance.set({index: 'bar'}, true).save(cb);},
        function(cb) {assertFind(model, 'index', 'foo', true, cb);},
        function(cb) {assertFind(model, 'index', 'bar', true, cb);}
      ], done);
    });

    it('should not use indexes that have been replaced', function(done) {
      var model = this.IndexedModel;
      var instance = this.instance;
      async.series([
        function(cb) {instance.set({replaceIndex: 'bar1'}, true).save(cb);},
        function(cb) {assertFind(model, 'replaceIndex', 'foo1', false, cb);},
        function(cb) {assertFind(model, 'replaceIndex', 'bar1', true, cb);}
      ], done);
    });

    it('should should fail if saving a duplicate index', function() {
      var instance = this.IndexedModel.create({index: 'foo'}, true);
      instance.save(function(err) {
        err.should.eq('instance with index already exists');
      });
    });
  });
});

describe('#_set', function() {

  before(function() {
    this.instance = new Instance();
    this.transformed = new Instance();
  });

  it('should unserialize data', function() {
    this.instance._set({
      text: 'a',
      number: 123,
      booleanTrue: true,
      booleanFalse: false
    }).should.deep.eq({
      text: 'a',
      number: 123,
      booleanTrue: true
    });
  });

  it('should remove guarded values', function() {
    this.instance._set({
      guarded: 'guarded',
      text: 'a'
    }).should.deep.eq({text: 'a'});
  });

  it('should apply mixin transforms in the correct order', function() {
    this.transformed._set({text: 'a'}).should.eq({a: '1(2(3(4(a))))'});
  });
});
