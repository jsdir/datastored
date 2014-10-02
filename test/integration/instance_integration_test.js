var async = require('async');
var chai = require('chai');

var testUtils = require('../test_utils');

var expect = chai.expect;

describe('Model (integration)', function() {

  before(function() {
    testUtils.setupOrm.call(this);
    testUtils.setupTestModels.call(this);
  });

  beforeEach(function(cb) {
    this.orm._resetDatastores(cb);
  });

  describe('#find()', function() {

    before(function() {
      this.IndexedModel = this.createModel({
        properties: {
          indexed: {type: 'string', index: true, cache: true},
          indexed_no_replace: {
            type: 'string', index: true, cache: true, replace: false
          }
        },
        callbacks: {
          beforeInput: function(values, cb) {
            cb(null, testUtils.appendValue(values, 'beforeInput'));
          },
          afterInput: function(values, cb) {
            cb(null, testUtils.appendValue(values, 'afterInput'));
          }
        }
      });
    });

    it('should mutate the index value by default', function(done) {
      var self = this;
      async.waterfall([
        function(cb) {
          var instance = self.IndexedModel.create({indexed: 'foo'});
          instance.save(function(err) {
            if (err) {return cb(err);}
            cb(null, instance.getId());
          });
        },
        function(id, cb) {
          self.IndexedModel.find('indexed', 'foo', function(err, instance) {
            if (err) {return cb(err);}
            instance.should.exist;
            instance.isNew.should.be.false;
            instance.isChanged().should.be.false;
            instance.getId().should.eq(id);
            cb();
          });
        }
      ], done);
    });

    it('should not mutate the index value if requested', function(done) {
      var self = this;
      async.waterfall([
        function(cb) {
          var instance = self.IndexedModel.create({indexed: 'foo'}, true);
          instance.save(function(err) {
            if (err) {return cb(err);}
            cb(null, instance.getId());
          });
        },
        function(id, cb) {
          self.IndexedModel.find('indexed', 'foo', true,
            function(err, instance) {
            if (err) {return cb(err);}
            instance.getId().should.eq(id);
            cb();
          });
        }
      ], done);
    });

    it('should only work with indexed properties', function() {
      var self = this;
      (function() {
        self.BasicModel.find('nonindex', 'foo', function() {});
      }).should.throw('attribute "nonindex" is not an index');
    });

    it('should callback with null if nothing is found', function(done) {
      this.IndexedModel.find('indexed', 'bar', function(err, instance) {
        if (err) {return done(err);}
        expect(instance).to.be.null;
        done();
      });
    });

    it('should use old indexes that have not been replaced', function(done) {
      var self = this;
      async.waterfall([
        function(cb) {
          var instance = self.IndexedModel.create({
            indexed_no_replace: 'foo'
          }, true);
          instance.save(function(err) {
            if (err) {return cb(err);}
            instance.set({
              indexed_no_replace: 'bar'
            }, true).save(function(err) {
              if (err) {return cb(err);}
              cb(null, instance.getId());
            });
          });
        },
        function(id, cb) {
          self.IndexedModel.find('indexed_no_replace', 'foo', true,
            function(err, instance) {
            if (err) {return cb(err);}
            instance.getId().should.eq(id);
            cb();
          });
        }
      ], done);
    });

    it('should not use indexes that have been replaced', function(done) {
      var self = this;
      async.waterfall([
        function(cb) {
          var instance = self.IndexedModel.create({indexed: 'foo'}, true);
          instance.save(function(err) {
            if (err) {return cb(err);}
            instance.set({indexed: 'bar'}, true).save(function(err) {
              if (err) {return cb(err);}
              cb(null, instance.getId());
            });
          });
        },
        function(id, cb) {
          self.IndexedModel.find('indexed', 'foo', true,
            function(err, instance) {
            if (err) {return cb(err);}
            expect(instance).to.be.null;
            cb();
          });
        }
      ], done);
    });
  });
});
