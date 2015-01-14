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
  id: datastored.Id({type: 'string'}),
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

  - `keyspace` (string, required)

    The redis key fragment and the cassandra column family name. This defaults to the model's name in lowercase.

  - `id` (`datastored.Id`, required)

    The model's id type.

  - `mixins` (array, optional)

    Used to extend the model with common functionality.

  - `statics` (object, optional)

    Defines static properties for the model constructor. This option will overwrite any existing static properties on conflict. Static functions are automatically bound to the model.

  - `methods` (object, optional)

    Defines methods for the model instance. This option will overwrite any existing instance methods on conflict. Instance methods are automatically bound to the instance.

  - `attributes` (object, required)

    Describes model attributes and their values. Attributes are defined with the names as keys and the attributes as values. Multiple built-in attribute types are exported from the `datastored` module:

    ```js
    {
      title: datastored.String({
        hashStores: [hashStores.mysql, hashStores.redis]
      }),
      description: datastored.String({
        hashStores: [hashStores.mysql],
        required: true,
        constraints: {
          length: {maximum: 10000}
        }
      })
    }
    ```

    Attribute options and built-in attribute options are described [here](attributes.md) with further detail.

  `input`, `output`, `save`, and `fetch` methods are provided to change data at the model level. More info about data flow can be found [here](data_flow.md).

  - `input` (function, optional)

    `function(data, options)`
    This method is applied to all input data.

    - `data` (object)
    - `options` (object)
      - `user` = false (boolean)

    - Returns: modified `data`

  - `output` (function, optional)

    `function(data, options)`
    This method is applied to all output data.

    - `data` (object)
    - `options` (object)
      - `user` = false (boolean)

    - Returns: modified `data`

  - `save` (function, optional)

    `function(data, options, cb)`
    This method is applied to all saved data.

    - `data` (object)
    - `options` (object)
      - `user` = false (boolean)
      - `attributes`

        `attributes` parameter from `fetch` and `get` instance methods

    - `cb` (function)

      Call `cb` as an errback with modified `data`.

  - `fetch` (function, optional)

    `function(data, options, cb)`
    This method is applied to all fetched data.

    - `data` (object)
    - `options` (object)
      - `user` = false (boolean)
      - `attributes`

        `attributes` parameter from `fetch` and `get` instance methods

    - `cb` (function)

      Call `cb` as an errback with modified `data`.

## Methods

### `Model.create(data[, options])`

Builds a new `Instance` with `data` and saves it. If successful, the returned promise is fulfilled with the instance including an id and the loaded data. `data` is transformed with the input transform set.

- `data` (object, required) ... Data to initialize the new `Instance` with.
- `options` (object, optional)
  - `user` = false (boolean, optional) ... Set to `true` to [apply user transforms](security.md) to `data`.

- Returns: `Promise` to be fulfilled with `Instance`

```js
Book
  .create({title: 'A Book', isbn: 1234567890})
  .then(function(instance) {
    console.log('Created and saved:', instance);
  }, function(err) {
    throw err;
  });
```

### `Model.withId(id[, options])`

Returns an `Instance` of type `Model` with its id set to `id`. `id` is transformed with the input transform set.

- `options` (object, options)
  - `user` = false (boolean, optional) ... Set to `true` to [apply user transforms](security.md) to `data`.

- Returns: `Instance`

```js
var book = Book.withId('1234567890');
```

### `Model.find(name, value[, options])`

Finds a single `Instance` with the value of index attribute `name` equal to `value`. If the instance is found, the returned promise is fulfilled with the instance including an id and the loaded data. If no such instance is found, the returned promise is fulfilled with `null`. `value` is transformed with the input transform set.

- `name` (string, required) ... The indexed attribute's name.
- `value` (*, required) ... The indexed attribute's value.
  - `user` = false (boolean, optional) ... Set to `true` to [apply user transforms](security.md) to `data`.

- Returns: `Promise` to be fulfilled with `Instance`

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
