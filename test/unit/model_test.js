var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

var datastored = require('../..')
var testUtils = require('../test_utils');

var expect = chai.expect;
chai.should();
chai.use(sinonChai);

describe.only('Model', function() {

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

  /*
  describe.only('#build', function() {

    it('should build an instance', function() {
      var instance = this.Model.build(data);
      instance.isNew().should.be.true;
      this.transforms.input.lastCall.thisValue.should.eq(instance);
      this.transforms.input.should.have.been.calledWith(data);
      instance.get('text').should.eq('a');
    });

    it('should apply user transforms if requested', function() {
      var instance = this.Model.build(data, true);
      instance.isNew().should.be.true;
      this.transforms.input.lastCall.thisValue.should.eq(instance);
      this.transforms.input.should.have.been.calledWith(data, true);
      instance.get('text').should.eq('a');
    });

    it('should set default values', function() {
      var data = {text: 'a', default1: 'b'};
      var instance = this.Model.build(data);
      this.transforms.input.lastCall.thisValue.should.eq(instance);
      this.transforms.input.should.have.been.calledWith(data);
      instance.get('text').should.eq('a');
      instance.get('default1').should.eq('b');
      instance.get('default2').should.eq('default2');
      instance.get('defaultFunc').should.eq('defaultFunc');
    });
  });
  */

  describe('#create', function() {

    it('should create and save an instance', function(done) {
      var transforms = this.transforms;
      this.Model
        .create({text: 'a'})
        .then(function(instance) {
          instance.get('text').should.eq('a');
          transforms.input.lastCall.thisValue.should.eq(instance);
          transforms.input.should.have.been.calledWith({text: 'a'});
          transforms.save.lastCall.thisValue.should.eq(instance);
          transforms.save.should.have.been.calledWith({text: 'a'});
        }).then(done, done);
    });

    it('should apply user transforms if requested', function(done) {
      var transforms = this.transforms;
      this.Model
        .create({text: 'a'}, true)
        .then(function(instance) {
          instance.get('text').should.eq('a');
          transforms.input.lastCall.thisValue.should.eq(instance);
          transforms.input.should.have.been.calledWith({text: 'a'}, true);
          transforms.save.lastCall.thisValue.should.eq(instance);
          transforms.save.should.have.been.calledWith({text: 'a'});
        }).then(done, done);
    });

    it('should set default values', function(done) {
      this.Model
        .create({text: 'a', default1: 'b'})
        .then(function(instance) {
          instance.get('text').should.eq('a');
          instance.get('default1').should.eq('b');
          instance.get('default2').should.eq('default2');
          instance.get('defaultFunc').should.eq('defaultFunc');
        }).then(done, done);
    });
  });

  describe('#withId', function() {

    it('should return an instance with the given id', function() {
      var instance = this.Model.withId('a');
      instance.getId().should.eq('a');
      this.transforms.input.lastCall.thisValue.should.eq(instance);
      this.transforms.input.should.have.been.calledWith({id: 'a'});
    });

    it('should apply user transforms if requested', function() {
      var instance = this.Model.withId('a', true);
      instance.getId().should.eq('a');
      this.transforms.input.lastCall.thisValue.should.eq(instance);
      this.transforms.input.should.have.been.calledWith({id: 'a'}, true);
    });
  });

  xdescribe('#find', function() {

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

describe('input transform', function() {

  before(function() {
    testUtils.createTestEnv(this);
  });

  it('should unserialize data', function(done) {
    var TypeModel = this.models.TypeModel;
    TypeModel.create().then(function(instance) {
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
    }).then(done, done);
  });

  it('should remove guarded values', function(done) {
    var Model = this.models.BasicUnitModel;
    Model.create().then(function(instance) {
      Model._transforms.input.call(instance, {
        guarded: 'guarded',
        text: 'a'
      }).should.deep.eq({text: 'a'});
    }).then(done, done);
  });

  it('should apply mixin transforms in the correct order', function(done) {
    var MixinModel = this.models.MixinModel;
    MixinModel.create().then(function(instance) {
      MixinModel._transforms.input.call(instance, {text: 'a'})
        .should.deep.eq({text: '1(2(3(4(a))))'})
    }).then(done, done);
  });
});
