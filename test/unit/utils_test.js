var chai = require('chai')

var utils = require('../../lib/utils');

chai.should();

describe('utils', function() {

  describe('#groupByDatastore()', function() {

    it.only('should group attributes by datastore', function() {
      utils.groupByDatastore(['foo', 'bar'], [
        {datastore: '1', attributes: ['foo', 'bar']},
        {datastore: '2', attributes: ['foo', 'bar']}
      ]).should.deep.eq({'1': ['foo', 'bar']});

      utils.groupByDatastore(['foo', 'bar'], [
        {datastore: '1', attributes: ['baz']},
        {datastore: '2', attributes: ['foo', 'bar']}
      ]).should.deep.eq({'2': ['foo', 'bar']});

      utils.groupByDatastore(['foo', 'bar'], [
        {datastore: '1', attributes: ['foo']},
        {datastore: '2', attributes: ['bar']}
      ]).should.deep.eq({'1': ['foo'], '2': ['bar']});

      utils.groupByDatastore(['foo', 'bar'], [
        {datastore: '1', attributes: ['foo']},
        {datastore: '2', attributes: ['bar']},
        {datastore: '3', attributes: ['foo', 'bar']}
      ]).should.deep.eq({'3': ['foo', 'bar']});
    });
  });
});
