var datastored = require('../..');

describe('Attribute', function() {

  it('should only be an integer or string when indexed', function() {
    datastored.String({indexed: true, datastores: [{indexStore: true}]});
    datastored.Integer({indexed: true, datastores: [{indexStore: true}]});
    (function() {
      datastored.Boolean({indexed: true, datastores: [{indexStore: true}]});
    }).should.throw('only strings and integers can be indexed');
  });

  it('should require at least one datastore', function() {
    (function() {
      datastored.String({datastores: []});
    }).should.throw('no datastores have been defined for the attribute');
  });
});
