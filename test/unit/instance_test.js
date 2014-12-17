var chai = require('chai');
var sinon = require('sinon');
var chaiAsPromised = require('chai-as-promised');

var datastored = require('../..');
var testUtils = require('../test_utils');

var expect = chai.expect;
chai.use(chaiAsPromised);

describe('Instance', function() {

  before(function() {
    testUtils.createTestEnv(this);
    this.Model = this.models.BasicUnitModel;
    this.modelOptions = this.options.BasicUnitModel;
  });

  describe('model options', function() {

    it('should assign "methods"', function() {
      return this.Model.create().then(function(instance) {
        instance.methodFunc().should.deep.eq(instance);
      });
    });
  });

  xdescribe('#fetch()', function() {

  });

  xdescribe('#save()', function() {

    it('should fail with serialization erros if they exist', function() {
      return instance.save();
    });
  });

  xdescribe('#getId()', function() {

    beforeEach(function() {
      this.instance = this.Model.withId('value');
    });

    it('should return the instance id', function() {
      this.instance.getId().should.eq('raw');
      _get.should.have.been.calledWith({id: 'raw'});
    });

    it('should apply user transforms if requested', function() {
      this.instance.getId(true).should.eq('withUserTransforms');
      _get.should.have.been.calledWith({id: 'raw'}, true);
    });
  });

  xdescribe('#get()', function() {

    it('should transform data by default', function() {
      var instance = this.BasicModel.create({foo: 'bar'}, true);
      instance.get('foo').should.eq('output(bar)');
    });

    it('should not transform data if requested', function() {
      var instance = this.BasicModel.create({foo: 'bar'}, true);
      instance.get('foo', true).should.eq('bar');
    });

    it('should extend transforms correctly', function() {
      var instance = this.TransformModel.create({foo: 'bar'}, true);
      instance.get('foo').should.eq('output0(output1(output2(bar)))');
    });

    it('should support getting multiple attributes', function() {
      var instance = this.BasicModel.create({foo: 'bar', bar: 'baz'}, true);
      var result = instance.get(['foo', 'bar'], true);
      result.should.deep.eq({foo: 'bar', bar: 'baz'});
    });
  });

  xdescribe('#save()', function() {

    before(function() {
      this.RequiredModel = this.createModel({
        attributes: {
          required: datastored.String({
            required: true, hashStores: [true]
          })
        }
      });

      this.ValidationModel = this.createModel({
        attributes: {
          bar: datastored.String({
            hashStores: [true],
            rules: {max: 2}
          }),
          baz: datastored.String({
            hashStores: [true],
            rules: {min: 4}
          })
        }
      });

      this.ErrorModel = this.createModel({
        asyncTransform: {
          save: function(options, data, cb) {
            cb('message');
          }
        }
      });
    });

    it('should fail if instance errors exist', function(done) {
      var instance = this.ErrorModel.create({foo: 'bar'});
      instance.save(function(err) {
        err.should.eq('message');
        done();
      });
    });

    it('should validate attributes', function(done) {
      var instance = this.ValidationModel.create({bar: 'abc', baz: 'abc'});
      instance.save(function(err) {
        err.should.deep.eq({
          bar: 'attribute "bar" must have a maximum of 2 characters',
          baz: 'attribute "baz" must have a minimum of 4 characters'
        });
        done();
      });
    });

    it('should validate required attributes', function(done) {
      var instance = this.RequiredModel.create({foo: 'bar'});
      instance.save(function(err) {
        err.should.deep.eq({required: 'attribute "required" is not defined'});
        done();
      });
    });

    it('should callback immediately if no attributes were changed', function() {
      var spy = sinon.spy();
      var instance = this.BasicModel.get('foo');
      instance.save(function(err) {
        if (err) {throw err;}
        spy();
      });
      spy.should.have.been.called;
    });
  });
});

/*
var chai = require('chai');

var attributes = require('../../lib/attributes');
var memoryDatastores = require('../../lib/datastores/memory');
var testUtils = require('../test_utils');

chai.should();
var expect = chai.expect;

describe('Instance (integration)', function() {

  var date = 1264982400000;
  var datetime = 1264982400000;

  before(function() {
    this.memoryHashStore = new memoryDatastores.MemoryHashStore();
    testUtils.setupOrm.call(this);

    this.Model = this.createModel({
      scopes: {
        all: [
          'integer',
          'string',
          'booleanTrue',
          'booleanFalse',
          'date',
          'datetime'
        ]
      },
      attributes: {
        integer: attributes.Integer({
          hashStores: [this.memoryHashStore]
        }),
        string: attributes.String({
          hashStores: [this.memoryHashStore]
        }),
        booleanTrue: attributes.Boolean({
          hashStores: [this.memoryHashStore]
        }),
        booleanFalse: attributes.Boolean({
          hashStores: [this.memoryHashStore]
        }),
        date: attributes.Date({
          hashStores: [this.memoryHashStore]
        }),
        datetime: attributes.Datetime({
          hashStores: [this.memoryHashStore]
        })
      }
    });
  });

  beforeEach(function(done) {
    this.memoryHashStore.reset(done);
  });

  beforeEach(function(done) {
    // Save all different attribute types.
    this.instance = this.Model.create({
      integer: 123,
      string: 'foo',
      booleanTrue: true,
      booleanFalse: false,
      date: new Date(date),
      datetime: new Date(datetime)
    }, true);

    this.instance.save(done);
  });

  describe('#save()', function() {

    it('should create a new instance', function(done) {
      testUtils.saveAndReload(this.instance, 'all', function(err, instance) {
        if (err) {return done(err);}
        instance.getId().should.exist;
        instance.toObject('all').should.deep.eq({
          integer: 123,
          string: 'foo',
          booleanTrue: true,
          booleanFalse: false,
          date: '2010-02-01',
          datetime: '2010-02-01T00:00:00.000Z'
        });
        done();
      });
    });

    it('should update an existing instance', function(done) {
      var scope = ['integer'];
      this.instance.set({integer: 456});
      testUtils.saveAndReload(this.instance, scope, function(err, instance) {
        if (err) {return done(err);}
        instance.get('integer', true).should.eq(456);
        done();
      });
    });

    it('should set model status', function(done) {
      this.instance.isNew.should.be.false;
      this.instance.isChanged().should.be.false;
      done();
    });
  });

  describe('#fetch()', function() {

    it('should only fetch requested attributes', function(done) {
      var scope = ['string'];
      testUtils.saveAndReload(this.instance, scope, function(err, instance) {
        if (err) {return done(err);}
        instance.get('string', true).should.eq('foo');
        expect(instance.get('integer')).to.be.undefined;
        done();
      });
    });

    it('should callback indicating if the instance was found', function(done) {
      var instance = this.Model.get('undefined');
      instance.fetch('all', function(err, fetched) {
        if (err) {return done(err);}
        fetched.should.be.false;
        done();
      })
    });
  });
});

 */