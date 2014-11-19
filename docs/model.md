# Models

## Methods

### `Model.build(data, applyUserTransforms)`

Builds a new `Instance` with `data`.

- Parameters
  + data (optional, object)

    Data to initialize the new `Instance` with. If `data` is not given, the `Instance` is initialized with no data.

  + applyUserTransforms = `false` (optional, boolean) ... Set to `true` to apply user transforms to `data`.

- Returns: `Instance` ... A new instance initialized with `data`.

```js
var emptyBook = Book.build();
var ourBook = Book.build({title: 'A Book'}};
```

### `Model.withId(id, applyUserTransforms)`

Returns an instance set to the given id.

- Parameters
  + id (required, {string, integer}) ... The id of the `Instance` to return.
  + applyUserTransforms = `false` (optional, boolean) ... Set to `true` to apply user transforms to `id`.

- Returns: `Instance` ... An instance set to the given id.

```js
var book = Book.withId(123);
```

### `Model.find(name, value, applyUserTransforms)`

Finds a single `Instance` with the value of index attribute `name` equal to `value`. If the instance is found, the returned promise is fulfilled with the instance. If no such instance is found, the returned promise is fulfilled with `null`.

- Parameters
  + name (required, string) ... The indexed attribute's name.
  + value (required, *) ... The indexed attribute's value.
  + applyUserTransforms = `false` (optional, boolean) ... Set to `true` to apply user transforms to `value`.

- Returns: `Promise`

```js
Book
  .find({isbn: 1234567890})
  .done(function(instance) {
    if (instance) {
      console.log('Found instance: ', instance);
    } else {
      console.log('Failed to find instance.');
    }
  }, function(err) {
    throw err;
  });
```

### `Model.create(data, applyUserTransforms)`

Builds a new instance with `data` and saves it. Since `Model.create(data, raw)` is only a shortcut for `Model.build(data, raw).save()`, it shares the same parameters as `Model.build`.

- Parameters
  + data (required, object) ... Data to initialize the new `Instance` with.
  + applyUserTransforms = `false` (optional, boolean) ... Set to `true` to apply user transforms to `data`.

- Returns: `Promise`

```js
Book
  .create({title: 'A Book', isbn: 1234567890})
  .done(function(instance) {
    console.log('Built and saved:', instance);
  }, function(err) {
    throw err;
  });
```

## Defining a model

A model can be defined with `orm.createModel`. `orm.createModel` is called with the model name and options.

```js
var datastored = require('datastored');

var orm = require('./orm');
var db = require('./db');

var Book = orm.createModel('Book', {
  keyspace: 'books',
  id: datastored.Id({type: 'string'}),
  attributes: {
    title: datastored.String({
      datastores: [db.MYSQL, db.REDIS]
    }),
    description: datastored.String({
      datastores: [db.MYSQL],
      required: true,
      rules: {
        max: 10000
      }
    }),
    isbn: datastored.Integer({
      datastores: [db.MYSQL],
      required: true
    })
  }
});
```

The model name is case-insensitive and must be unique to the orm.

### Options

- `keyspace` (required, string)

  The redis key fragment and the cassandra column family name. This defaults to the model's name in lowercase.

- `id` (required, `datastored.Id`)

  The model's id attribute.

- `mixins` (optional, array)

  Used to extend the model with common functionality.

- `statics` (optional, object)

  Defines static properties for the model constructor. This option will overwrite any existing static properties on conflict. Static functions are auotmatically bound to the model.

- `methods` (optional, object)

  Defines methods for the model instance. This option will overwrite any existing instance methods on conflict. Instance methods are automatically bound to the instance.

- `attributes` (required, object)

  Describes model attributes and their values. Attributes are defined with the names as keys and the options as values. Multiple builtin attrobite options are exported from the `datastored` module:

  ```js
  {
    attributes: {
      title: datastored.String({
        datastores: [db.MYSQL, db.REDIS]
      }),
      description: datastored.String({
        datastores: [db.MYSQL],
        required: true,
        rules: {
          max: 10000
        }
      })
    }
  }
  ```

  Attribute options and built-in attribute options are described [here](attributes.md) with further detail.

## Extending a model

To have several model types share common functionality, use mixins.
