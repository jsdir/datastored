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

  beforeEach(function() {
    sinon.stub(this.Model._transforms, 'output', function(data) {
      return testUtils.wrapValues(data, 'output');
    });
    this.transforms = this.Model._transforms;
  });

  afterEach(function() {
    this.transforms.output.restore();
  });

  describe('model options', function() {

    it('should assign "methods"', function() {
      return this.Model.create().then(function(instance) {
        instance.methodFunc().should.deep.eq(instance);
      });
    });
  });

  describe('#get()', function() {

    it('should get a single attribute', function() {
      var output = this.transforms.output;
      return this.Model.create({text: 'a'}).then(function(instance) {
        instance.get('text').should.eq('output(a)');
        output.lastCall.thisValue.should.eq(instance);
        output.should.have.been.calledWithExactly({
          text: 'a'
        }, {text: null}, undefined);
      });
    });

    it('should get multiple attributes', function() {
      var output = this.transforms.output;
      return this.Model.create({text: 'a', text2: 'b'}).then(function(instance) {
        instance.get(['text', 'text2']).should.deep.eq({
          text: 'output(a)', text2: 'output(b)'
        });
        output.lastCall.thisValue.should.eq(instance);
        output.should.have.been.calledWithExactly({
          text: 'a', text2: 'b'
        }, {text: undefined, text2: undefined}, undefined);
      });
    });

    it('should get multiple attributes with options', function() {
      var output = this.transforms.output;
      return this.Model.create({text: 'a', text2: 'b'}).then(function(instance) {
        instance.get({text: 1, text2: 2}).should.deep.eq({
          text: 'output(a)', text2: 'output(b)'
        });
        output.lastCall.thisValue.should.eq(instance);
        output.should.have.been.calledWithExactly({
          text: 'a', text2: 'b'
        }, {text: 1, text2: 2}, undefined);
      });
    });

    it('should apply user transforms if requested', function() {
      var output = this.transforms.output;
      return this.Model.create({text: 'a'}).then(function(instance) {
        instance.get('text', true).should.eq('output(a)');
        output.lastCall.thisValue.should.eq(instance);
        output.should.have.been.calledWithExactly({
          text: 'a'
        }, {text: null}, true);
      });
    });
  });

  describe('#getId()', function() {

    beforeEach(function() {
      this.instance = this.Model.withId('value');
    });

    it('should return the instance id', function() {
      this.instance.getId().should.eq('output(value)');
      this.transforms.output.lastCall.thisValue.should.eq(this.instance);
      this.transforms.output.should.have.been.calledWithExactly({
        id: 'value'
      }, null, undefined);
    });

    it('should apply user transforms if requested', function() {
      this.instance.getId(true).should.eq('output(value)');
      this.transforms.output.lastCall.thisValue.should.eq(this.instance);
      this.transforms.output.should.have.been.calledWithExactly({
        id: 'value'
      }, null, true);
    });
  });

  xdescribe('#fetch()', function() {

    it('should only fetch requested attributes', function(done) {
      var scope = ['string'];
      testUtils.saveAndReload(this.instance, scope, function(err, instance) {
        if (err) {return done(err);}
        instance.get('string', true).should.eq('foo');
        expect(instance.get('integer')).to.be.undefined;
        done();
      });
    });

    it('should resolve indicating if the instance was found', function(done) {
      var instance = this.Model.withId('undefined');
      return instance.fetch('all').then(function(instance) {
        expect(instance).to.be.null;
      });
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

    it('should fail with serialization errors if they exist', function() {
      return instance.save();
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
});

 */