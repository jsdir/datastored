Model
=====

A model is a static definition of an `Instance`, its attributes, and their behaviors.

```js
// Book.js

var datastored = require('datastored');
var orm = require('./orm');
var hashStore = require('./hash_store');

var Book = orm.createModel('Book', {
  keyspace: 'book',
  id: 'string',
  attributes: {
    title: datastored.String({
      required: true,
      hashStores: [hashStore]
    }),
    subtitle: datastored.String({
      hashStores: [hashStore]
    }),
    isbn: datastored.Integer({
      required: true,
      hashStores: [hashStore]
    })
  }
});

module.exports = Book;
```

## Defining a model

### `orm.createModel(modelName, options)`

Models are defined with `orm.createModel`. The model name is case-insensitive and must be unique to the orm.

- `options`

  - `keyspace` (required, string)

    The redis key fragment and the cassandra column family name. This defaults to the model's name in lowercase.

  - `id` (required, string)

    The model's id type.

  - `mixins` (optional, array)

    Used to extend the model with common functionality.

  - `statics` (optional, object)

    Defines static properties for the model constructor. This option will overwrite any existing static properties on conflict. Static functions are automatically bound to the model.

  - `methods` (optional, object)

    Defines methods for the model instance. This option will overwrite any existing instance methods on conflict. Instance methods are automatically bound to the instance.

  - `attributes` (required, object)

    Describes model attributes and their values. Attributes are defined with the names as keys and the options as values. Multiple built-in attribute options are exported from the `datastored` module:

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

  - `input` (optional, function)

  - `output` (optional, function)

  - `outputAsync` (optional, function)

  - `save` (optional, function)

  - `fetch` (optional, function)

## Methods

### `Model.create(data[, options])`

Builds a new `Instance` with `data` and saves it. If successful, the returned promise is fulfilled with the instance including an id and the loaded data.

- `data` (object, required) ... Data to initialize the new `Instance` with.
- `options` (object, optional)
  - `user` = false (boolean, optional) ... Set to `true` to [apply user transforms](security.md) to `data`.

- Returns: `Promise`

```js
Book
  .create({title: 'A Book', isbn: 1234567890})
  .then(function(instance) {
    console.log('Built and saved:', instance);
  }, function(err) {
    throw err;
  });
```

### `Model.find(name, value[, options])`

Finds a single `Instance` with the value of index attribute `name` equal to `value`. If the instance is found, the returned promise is fulfilled with the instance including an id and the loaded data. If no such instance is found, the returned promise is fulfilled with `null`.

- `name` (string, required) ... The indexed attribute's name.
- `value` (*, required) ... The indexed attribute's value.
  - `user` = false (boolean, optional) ... Set to `true` to [apply user transforms](security.md) to `data`.

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

## Extending a model

To have several model types share common functionality, use mixins.
