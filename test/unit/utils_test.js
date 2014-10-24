var chai = require('chai')

var utils = require('../../lib/utils');

chai.should();

describe('utils', function() {

  describe('#groupByHashStore()', function() {

    it('should group attributes by hashStore', function() {
      utils.groupByHashStore(['foo', 'bar'], [
        {hashStore: '1', attributes: ['foo', 'bar']},
        {hashStore: '2', attributes: ['foo', 'bar']}
      ]).should.deep.eq([
        {hashStore: '1', attributes: ['foo', 'bar']}
      ]);

      utils.groupByHashStore(['foo', 'bar'], [
        {hashStore: '1', attributes: ['baz']},
        {hashStore: '2', attributes: ['foo', 'bar']}
      ]).should.deep.eq([
        {hashStore: '2', attributes: ['foo', 'bar']}
      ]);

      utils.groupByHashStore(['foo', 'bar'], [
        {hashStore: '1', attributes: ['foo']},
        {hashStore: '2', attributes: ['bar']}
      ]).should.deep.eq([
        {hashStore: '1', attributes: ['foo']},
        {hashStore: '2', attributes: ['bar']}
      ]);

      utils.groupByHashStore(['foo', 'bar'], [
        {hashStore: '1', attributes: ['foo']},
        {hashStore: '2', attributes: ['bar']},
        {hashStore: '3', attributes: ['foo', 'bar']}
      ]).should.deep.eq([
        {hashStore: '3', attributes: ['foo', 'bar']}
      ]);
    });
  });
});
