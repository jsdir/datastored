var datastored = require('../../..');
var shared = require('./shared');

xdescribe('HasMany relation', function() {

  shared.testHasMany(datastored.relations.HasMany);
  shared.testRelatedModelRequired(datastored.relations.HasOne);
});
