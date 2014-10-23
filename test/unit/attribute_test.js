var datastored = require('../..');

describe('Attribute', function() {

  it('should only be an integer or string when indexed', function() {
    datastored.String({indexDatastore: {indexStore: true}});
    datastored.Integer({indexDatastore: {indexStore: true}});
    (function() {
      datastored.Boolean({indexDatastore: {indexStore: true}});
    }).should.throw('only strings and integers can be indexed');
  });

  it('should require at least one datastore', function() {
    (function() {datastored.String({});})
      .should.throw('no datastores have been defined for the attribute');
  });
});
