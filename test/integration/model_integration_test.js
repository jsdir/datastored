var async = require('async');
var chai = require('chai');

var attributes = require('../../lib/attributes');
var memoryDatastores = require('../../lib/datastores/memory');
var testUtils = require('../test_utils');

chai.should();
var expect = chai.expect;

describe('Model (integration)', function() {

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

  describe('#find()', function() {

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
      this.instance = this.IndexedModel.create({index: 'foo', replaceIndex: 'foo1'}, true);
      this.instance.save(done);
    });

    beforeEach(function(done) {
      this.IndexedModel.create({index: 'transformed'}).save(done);
    });

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
  });
});
