var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

var datastored = require('../..')
var testUtils = require('../test_utils');

chai.should();
chai.use(sinonChai);

describe('Model', function() {

  before(function() {
    var self = this;
    testUtils.setupOrm.call(this);
    testUtils.setupTestModels.call(this);

    this.assertCreateFails = function(options, message, newModel) {
      (function() {
        if (newModel) {
          self.createNewModel(options);
        } else {
          self.createModel(options);
        }
      }).should.throw(message);
    };
  });

  // Test model options.

  it('should require attributes', function() {
    var options = _.omit(testUtils.baseOptions, 'attributes');
    this.assertCreateFails(options, '"attributes" is not defined', true);
  });

  it('should require an id attribute', function() {
    var options = _.omit(testUtils.baseOptions, 'id');
    this.assertCreateFails(options, '"id" is not defined', true);
  });

  it('should require a keyspace', function() {
    var options = _.omit(testUtils.baseOptions, 'keyspace');
    this.assertCreateFails(options, '"keyspace" is not defined', true);
  });

  it('should have "staticMethods" from options', function() {
    this.BasicModel.func().should.deep.eq(this.BasicModel);
  });

  it('should require the id to be an integer', function() {
    this.assertCreateFails({
      id: datastored.Boolean
    }, 'id can only be string or integer');
  });

  describe('#find()', function() {

    it('should ensure that the query attribute is an index', function() {
      var BasicModel = this.BasicModel;
      function noop() {}

      // Test undefined attribute.
      (function() {BasicModel.find('undefined', 'bar', noop);})
        .should.throw('"undefined" is not defined');
      // Test attribute that is not an index.
      (function() {BasicModel.find('foo', 'bar', noop);})
        .should.throw('attribute "foo" is not an index');
    });
  });
});
