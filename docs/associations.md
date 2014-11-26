Associations
============

Datastored provides options for relational modeling that can describe relationships between models. Assiciations are defined as attributes:

```js
var datastored = require('datastored');

var model = orm.model('Model', {
  keyspace: 'model',
  attributes: {
    author: datastored.HasOne('User')
  }
});
```

## Association Types

Several association types are already defined by datastored:

- `datastored.HasOne`
- `datastored.RedisList`
- `datastored.RedisSet`

### `datastored.HasOne(options)`

- Parameters
  + hashStores
  + required
  + guarded
  + hidden
  + joinedAttributes
  + link

`.get` interface:
  raw: null or Instance object.
  user transforms: 
`.fetch` interface:
  plain attr name: 'attrName'
  handles {attrName: ['joinedProp', 'joinedProp2']}
`.save` interface:
  .save `another instance` unassignment/assignment of link/joinedProperties should change
  .save `null` should chenge link, and joinedAttributes 

- If link is set up, and joined Properties are changed, any linked models that joined those properties will be updated afterwards. 

### `datastored.RedisList(associationStore)`

- Parameters
  + store (RedisAssociationStore)
  + link

`.get` interface:
  in user transform mode:
    {listAttrName: {page: {limit, offset}, attributes: [...]}} => `[]` (direct results)
  Page defaults to a fixed number of results (10).

`.save` interface:
  + immutability helpers
    * push
    * pushl?

- supports pushing instances of multiple types (document how this will be done when id generation is documented)
- support link when ading/removing child from list.

### `datastored.RedisSet(associationStore)`

- Parameters
  + store (RedisAssociationStore)
  + set

`.save` interface
  + immutability helpers
    * add
    * remove

- supports adding instances of multiple types
- support link when ading/removing child from set.

### `datastored.RedisSortedSet(associationStore)` [later]

- Parameters
  + store (RedisAssociationStore)

### `datastored.CassandraList(associationStore)` [later]
