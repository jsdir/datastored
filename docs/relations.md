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


Collections
===========
HasMany and ManyToMany relational attributes have collections as values.
Collections are the result of relations.
Are collections only involved with relations? What about as the result of find?

temp
- returning items in an owned collection collection.get('images')
- feeds
- user.collections
