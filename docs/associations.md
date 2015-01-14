Associations
============

Datastored can describe relationships between models with associations. Associations are defined as model attributes:

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

Provided are several built-in associations that can model 1:1, 1:n, and n:n relationships between models of any type. They are listed below grouped by their order:

- 1:1
  - `datastored.HasOne`
- 1:n and n:n
  - `datastored.RedisList`
  - `datastored.RedisSet`

### Options

Associations can be constructed with options:

```js
datastored.HasOne({required: true, type: 'User', link: 'book'})
```

Although options will differ between associations, all associations share two common options: `link` and `type`.

#### `link`

`link` is used to make associations reversible. Instances in reversible associations can be accessed both ways. `link` must be set to the attribute on the target model with which a reversible link should be formed. In the following example, the `Book` and `Author` instances are reversibly linked.

```js
var Author = orm.createModel({
  keyspace: 'author',
  attributes: {
    book: datastored.HasOne({type: 'Book', link: 'author'})
  }
});

var Book = orm.createModel({
  keyspace: 'book',
  attributes: {
    author: datastored.HasOne({type: 'Author'}),
    title: datastored.String({hashStores: [hashStore]})
  }
});

Author.create({
  name: 'John Doe',
  book: {
    title: 'My Recipes'
  }
}).then(function(author) {
  // book === author.book
  var book = author.get('book');
  // author === book.author
  assert(book.get('author') === author);
});
```

#### `type`

By default, associations support target instances with multiple types. The references are stored as a concatenation of instance type and id. The `type` option is not needed in this scenario. However, if it is already known that the association will link instances of only one type, the `type` option can be set to the target model name. When `type` is set, the attributes will only accept instances of the given type. Only the instance id will be persisted and the type will be inferred from the definition on fetch. Because the type does not need to be stored, using the `type` option saves more space, an important choice when dealing with situations where space is at a premium, such as in-memory datastores like Redis.

## 1:1 associations

### `datastored.HasOne(options)`

- `options`

  `HasOne` has many of the same options that a normal attribute has since they are both stored the same way.

  - `required` (boolean, optional)
  - `hashStores` (array, required)
  - `guarded` (boolean, optional)
  - `hidden` (boolean, optional)
  - `joinedAttributes` (array, optional)

    Set this to a list of non-virtual attributes existing on the child model to copy the attributes to the parent and to subsequently keep the copied parent attributes in sync with the child. Although `joinedAttributes` can be specified without `link`, a link is required if the child's `joinedAttributes` should stay in sync with those of the parent.

  - `link` (string, optional)

    This option must be defined for syncing `joinedAttributes` since the child must know its parent in order to update its joined properties once they change.

#### Usage

`HasOne` association attributes can be saved with either an Instance or `null`. Saving as `null` detaches the child instance.

```js
Author
  .create({name: 'John Doe'})
  .then(function(john) {
    return Book
      .create({title: 'A book'})
      .then(function(book) {
        return book.save({author: john});
      })
      .then(function(book) {
        return book.save({author: null});
      });
  });
```

Nested models can also be saved using a single object.

```js
Author
  .create({
    name: 'John Doe',
    favorite_book: {
      title: 'A book',
      isbn: 12345
    }
  });
```

When fetching a child, the child attributes to fetch must also be defined. Child attributes to fetch can be defined with a list or object. With an object, the keys must be attribute names, and the values must be `true`. It is also possible to fetch unlimited levels of nested children.

```js
author.get({
  name: true,
  book: ['title', 'isbn']
}).then(function(author) {
  console.log(author);
  /*
  {
    name: 'John Doe',
    book: {
      title: 'A book',
      isbn: 12345
    }
  }
 */
});
fetch({child: ["attr1", "attr2"]})

// Fetch nested models.
author.fetch({
  child: {
    attr1: true,
    attr2: true,
    grandchild: ['attr1']
  }
});
```

## 1:n and n:n associations

Before getting to the different HasMany associations, it is important to know that HasMany (1:n) associations can be used to make ManyToMany associations (n:n) by using links. Since the parent and child in a HasMany association can be the same model, the association can link to itself. This can be used to model common user relationships.

```js
var User = orm.createModel('User', {
  keyspace: 'user',
  attributes: {
    name: datastored.String({hashStores: [hashStore]}),
    friends: datastored.RedisSet({type: 'User', link: 'friends'})
  }
});

Promise.all(
  john: User.create({name: 'John Doe'}),
  jane: User.create({name: 'Jane Smith'})
).then(function(users) {
  return users.john
    // Add a friend.
    .save({friends: {add: users.jane}})
    .then(function() {
      return users.jane.get({friends: {pop: true}});
    }).then(function(friend) {
      // Confirms a functional ManyToMany relationship.
      assert(friend === users.john);
    });
});
```

#### Swapped Definitions

Though the reversible links `a.HasOne <-> b.HasMany` and `b.HasMany <-> a.HasOne` have swapped definitions, datastored considers them equivalent.

### `datastored.RedisList(options)`

- `options`
  - `store` (`RedisAssociationStore`, required)
  - `link` (string, optional)

#### Usage

get({attributes}, {forceFetch: false, output: true, applyUserTransforms: true})
- force fetch attributes (output or no output)
- fetch (lazy-load) attributes (output or no output)

- Most redis commands for the LIST data structure can be used. Datastored just translates between instances and their references. For example "add".
- instance.save only uses commands that modify the list (like add, remove)
- instance.get only can use commands that do not modify the list and return a value, such as range or get.

Get:

```js
author
  .get({
    books: {
      fetch: ['title', 'isbn'], // Apply fetch to the instance.
      command: ['all']
    }
  }, true)
  .then(function(books) {
    console.log('Books by author:', books);
  });

author
  .get({
    name: null,
    books: ['range', 1, 2] // Short form Redis commands.
  }, true)
  .then(function(author) {
    util.format('Books by %s: %s', author.name, author.books);
  });
```

Save:

```js
// Different ways to save with various short forms.

author.save({
  journals: ['push', journal1, journal2],
  books: ['push', [book1, book2]], // Redis command and arguments.
  publications: ['push', publications]
});
```

Supported Methods:

- `lindex`
- `linsert`
- `llen`
- `lpop`
- `lpush`
- `lrange`
- `lrem`
- `lset`
- `ltrim`
- `rpop`
- `rpush`

- save works on all commands
- get works on all commands and additionally returns the values as an array.

### `datastored.RedisSet(options)`

- `options`
  - `store` (`RedisAssociationStore`, required)

#### Usage

`datastored.RedisSet` has different usage parameters than those of `RedisList`.

Supported Methods:

- `sadd`
- `scard`
- `sismember`
- `smembers`
- `spop`
- `srandmember`
- `srem`
