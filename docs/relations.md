Relations
=========
Datastored provides options for relational modeling that can describe relationships between models. Relations are defined in the model options:

```js
var datastored = require('datastored');

var model = orm.model('Model', {
  relations: {
    users: {
      type: datastored.relations.HasMany,
      model: 'User'
    }
  }
});
```

There are three different relation types that can be used by a model:

  - HasOne
  - HasMany
  - ManyToMany


HasOne
------
This is datastored's implementation of a **1:1** relationship between models.

#### Options
- **`join`**: (type: boolean, default: false) Embeds the related model within the attributes of the parent model. All of the model's attributes are joined by default.
- **`joinedAttributes`**: (type: array, default: all) Joins only certain attributes from the related model.
- **`reverseRelation`**: Reverse relations


HasMany
-------
This is the ORM's implementation of a **1:n** relationship between models. The options for this relationship essentially define a Collection.

#### Options
- **`audit`**: (type: boolean, default: false) Includes the time when the relationship was made.
- **`sortable`**: (type: boolean, default: false) Includes the time when the relationship was made.
- **`useJoinTable`**: (type: boolean, default: false) Forces cassandra to use a column family as a join table. By default, cassandra uses columns when mapping the related models in a `HasMany` relationship. A join table might be needed for a large number of related models or for spreading the data more evenly across the cluster.


ManyToMany
----------
This is the ORM's implementation of an **n:n** relationship between models.

#### Options
- **`join`**: Embed the related model within the attributes of the referencing model.


Collection
==========

Collection is sometimes seeded with data when the parent model joins the attribute. Pagination is also supported.

#### limit offset

#### count

#### show
_.map show on all contained models.

The `HasMany` and `HasAndBelongsToMany` relational attributes have collections as values.
Collections are the result of relations.

temp
- returning items in an owned collection collection.get('images')
- feeds
- user.collections

HasOne
------
Establish reverse relations with `BelongsTo`.

- join: (joins all by default if enabled)
- joinedAttributes

HasMany
-------
Establish reverse relations with `BelongsTo`. Makes the relational attribute value a `Collection`.

BelongsTo
---------
TODO: How does `BelongsTo` know what relation it is paired with?

- join: (joins all by default if enabled)
- joinedAttributes (should also make it possible to include permission details somehow)

HasAndBelongsToMany
-------------------
Text.

Tree
----

maxDepth: int


Relation Options
================

- cache: true
- audit: Includes the time when the (or each) relationship was made.
- model: (optional) restrict to a model

Any relation that returns a `Collection` has the following options:

- sort: popularity, name[a-z]
  - redis creates zsets for each sort option. Cassandra has this built in.
- cassandra join table (alternative to storing in a column)
