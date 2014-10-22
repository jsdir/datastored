var async = require('async');
var chai = require('chai');

var datastored = require('../..');
var testUtils = require('../test_utils');

chai.should();

describe('datastored', function() {

  describe('#mapAttributes()', function() {

    it('should map attribute values to a function', function() {
      function transform(value) {
        return 'foobar'
      }
      var func = datastored.mapAttributes(['foo', 'bar'], transform);
      func({foo: 'foo', bar: 'bar', baz: 'baz'})
        .should.deep.eq({foo: 'foobar', bar: 'foobar', baz: 'baz'});
    });
  });

  describe('#createOrm()', function() {

    before(function() {
      testUtils.setupOrm.call(this);
    });

    it('should use a stub id generator if `generateId` is not defined',
    function(done) {
      var orm = this.orm;

      async.series([
        function(cb) {
          orm.generateId(3, function(err, id) {
            if (err) {return cb(err);}
            id.should.eq('1;3');
            cb();
          });
        },
        function(cb) {
          orm.generateId('model', function(err, id) {
            if (err) {return cb(err);}
            id.should.eq('2;model');
            cb();
          });
        }
      ], done);
    });
  });
});
