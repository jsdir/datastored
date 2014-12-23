Associations
============

Datastored provides options for relational modeling that can describe relationships between models. Associations are defined as model attributes:

```js
var datastored = require('datastored');

var model = orm.model('Book', {
  keyspace: 'book',
  attributes: {
    author: datastored.HasOne({type: 'User'}),
    pages: datastored.RedisList({type: 'Page'})
  }
});
```

## Association Types

Several association types are provided by datastored:

- `datastored.HasOne`
- `datastored.RedisList`
- `datastored.RedisSet`

### datastored.HasOne

Parent and child model.

#### Attribute Options

`HasOne` has many of the same attribute options that a normal attribute has since the representations are similar. The id is stored in one or more HashStores.

+ required
+ hashStores
+ guarded
+ hidden
+ joinedAttributes

  Set to a list of non-virtual attributes existing on the child model to copy the attributes to the parent and to subsequently keep the copied parent attributes in sync with the child. Although `joinedAttributes` can be specified without a parent link, a link is required if the `joinedAttributes` must stay in sync.

+ link

  Set to the `HasOne` association attribute on the child to establish a two-way link:

  `parent.child <-> child.parent`

  A parent-child link is required for syncing `joinedAttributes`.

#### Usage

Fetch:

```js
fetch({child: ["attr1", "attr2"]})
// or use tree
fetch({child: {attr1: true, attr2: true, grandchild: ['attr1']}})
```

### datastored.RedisList

`datastored.RedisList(associationStore)`

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
- support link when adding/removing child from list.

### datastored.RedisSet

`datastored.RedisSet(associationStore)`

- Parameters
  + store (RedisAssociationStore)
  + set

`.save` interface
  + immutability helpers
    * add
    * remove

- supports adding instances of multiple types
- support link when adding/removing child from set.

### `datastored.RedisSortedSet(associationStore)` [later]

- Parameters
  + store (RedisAssociationStore)

### `datastored.CassandraList(associationStore)` [later]
