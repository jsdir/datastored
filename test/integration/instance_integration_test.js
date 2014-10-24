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
