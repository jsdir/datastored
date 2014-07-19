# Models

## Defining a model

A model can be defined with `orm.createModel`. `orm.createModel` is called with the model name and options.

```js
var orm = require('./orm');

var Book = orm.createModel('Book', {
  column: 'books',
  properties: {
    id: {
      type: 'number',
      primary: true
    },
    title: {
      type: 'string',
      cached: true
    },
    description: {
      type: 'string',
      rules: {
        required: true,
        max: 10000
      }
    },
    isbn: {
      type: 'integer',
      rules: {
        required: true
      }
    }
  }
});
```

The model name is case-insensitive and must be unique to the orm.

### Options

#### column

Is the redis key fragment and the cassandra column name. This defaults to the model's name in lowercase.

#### properties

**(required)** Defines the model's properties.

#### extends

Allows the model to extend the definition of another model. If a model is extended with options and an overlapping callback is found, the callbacks will be chained with the existing callback running before the extension's callback.

#### mixins

Can be used to extend a model's options. Options are extended differently by type:

- option properties (attributes)
  - If the option property is not an object (`column`, `softDelete`) are overwritten by the mixin on conflict.
  - If the option property is an object, the objects keys are overwritten on naming conflict.
- option functions
  - `callbacks` are composed synchronously or asynchronously based on the function name. More details about how different callbacks are composed can be found in the [documentation for callbacks](callbacks.md).

#### relations

Defines the model's relations. Relations are described [here](relations.md) in further detail.

#### scopes

Defines the model's scopes.

#### audit

When set to `true`, the model will be given two new fields, `created_at` and `updated_at`. These fields will be controlled by datastored. Defaults to `false`.

#### callbacks

Defines actions to perform at different times in the model's lifecycle. More documentation about callbacks can be found [here](callbacks.md).

#### methods

Defines methods for the model instance. This option will overwrite any existing instance methods on conflict.

#### staticMethods

Defines methods for the model constructor. This option will overwrite any existing static methods on conflict.

## Properties

The `properties` option describes model properties and their values. Every model has a default primary `id` property that uses the orm's `generateId` to set the value. This property can be overridden.

Because they have their own options, properties are defined with the names as keys and the options as values:

```js
properties: {
  title: {
    type: 'string',
    cached: true
  },
  description: {
    type: 'string',
    rules: {
      required: true,
      max: 10000
    }
  }
}
```

### Property options

#### type

**(required)** Defines the property type. This is used by marshallers to serialized the value to the correct formats.

#### primary

When set to `true`, the property will be used as the model's primary key. Since a model can have only one primary key, only one property can be `primary`. Defaults to `false`.

#### index

Unlike the `primary` option, any property can become indexed if `index` is set to `true`. Using indexes is the only way to ensure uniqueness in datastored. Defaults to `false`.

#### cached

When set to `true`, the property will be cached. Defaults to `false`.

#### immutable

When set to `true`, datastored will only be able to set this attribute on a new, unsaved model. In all other occurrences, setting the variable will be ignored. Defaults to `false`.

#### rules

Defines the property's rules. Rules are described [here](rules.md) in further detail.

## Extending a model

Multiple model types can be classified under a parent model. The model types will be stored in the parent model's column.

## Static Methods

Static methods are called on the model class.

For most of these methods, the callback is optional. If a callback is not specified, the method will return a chainable object. Also, many of these methods have a `raw` parameter. Set `raw` to `true` when you know the values that you are putting into the model and to `false` when using values from user input. `raw` will always default to false.

#### .create(`attributes`[, `raw`]) -> `Instance`

Will construct a new instance of the model with `attributes`. If `raw` is set to `true`, `attributes` will not be passed through `input` mutation. If the input is invalid, errors will be merged into `model.inputErrors` and the model will be marked as invalid.

| Description         | Type       | Required | Default |
|:--------------------|:-----------|:---------|:--------|
| Model attributes    | `{}`       | Yes      |         |
| Use raw attributes? | `boolean`  | No       | `false` |

```js
var book = Book.create({isbn: 123});
```

#### .get(`pk`[, `raw`]) -> `Instance`

Gets a model from a primary key. This method does not fetch from any datastores, it is just a convenience method that creates a new model and assigns the primary key to `pk`. If `raw` is set to `true`, `pk` will not be passed through `input` mutation. If `pk` is an invalid value, the error will be merged into `model.inputErrors` and the model will be marked as invalid.

| Description         | Type      | Required | Default |
|:--------------------|:----------|:---------|:--------|
| Primary key         | `*`       | Yes      |         |
| Use raw attributes? | `boolean` | No       | `false` |

```js
var book = Book.get(2);
```

#### .find(`attribute`, `value`, [, `raw`], `callback`)

Finds any model that has index `attribute` that matches `value`. If `raw` is set to `true`, `value` will not be passed through `input` mutation. If any of the query values are invalid, errors will be merged into `model.inputErrors` and the model will be marked as invalid.

| Description         | Type       | Required | Default |
|:--------------------|:-----------|:---------|:--------|
| Attribute           | `string`   | Yes      |         |
| Value               | `*`        | Yes      |         |
| Use raw attributes? | `boolean`  | No       | `false` |
| Callback            | `function` | True     |         |

```js
Book.find('isbn', 123, function(err, book) {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Found:', book);
  }
});
```

## Instance Methods

Instance methods can be called on model instances.

### Access requests

Some of these methods have a `req` parameter. This is an optional access request, an `object` that can be used to implement ACLs and authorization subsystems with mixins.

#### .set(`attributes`[, `raw`]) -> `Instance`

Set `attributes` and overwrites existing ones on conflict. If `raw` is set to `true`, `attributes` will not be passed through `input` mutation. If the input is invalid, errors will be merged into `model.inputErrors` and the model will be marked as invalid. `set` will delete errors from `inputErrors` if the value is valid. If the new value is invalid, the error message will overwrite any existing messages in `inputErrors`.

| Description         | Type       | Required | Default |
|:--------------------|:-----------|:---------|:--------|
| Model attributes    | `{}`       | Yes      |         |
| Use raw attributes? | `boolean`  | No       | `false` |

```js
book.set({name: 'foo', isbn: 123});
```

##### Alternative usage: .set(`name`, `value`[, `raw`]) -> Instance

The alternative usage can be used to set a single attribute.

| Description         | Type      | Required | Default |
|:--------------------|:----------|:---------|:--------|
| Attribute name      | `string`  | Yes      |         |
| Attribute value     | `*`       | Yes      |         |
| Use raw attributes? | `boolean` | No       | `false` |

```js
book.set('isbn', 123);
```

#### .get(`attribute`[, `raw`]) -> `*`

Gets the value of `attribute`. If `raw` is set to `true`, the result value will not be passed through `output` mutation.

| Description       | Type      | Required | Default |
|:------------------|:----------|:---------|:--------|
| Attribute name    | `string`  | Yes      |         |
| Return raw value? | `boolean` | No       | `false` |

```js
var name = book.get('name');
console.log(name); // -> "foo"
```

##### Alternative usage: .get(`attributes`[, `raw`]) -> `*`

The alternative usage can be used to get multiple `attributes`.

| Description       | Type      | Required | Default |
|:------------------|:----------|:---------|:--------|
| Attribute names   | `array`   | Yes      |         |
| Return raw value? | `boolean` | No       | `false` |

```js
var data = book.get(['isbn', 'name']);
console.log(data); // -> {"isbn": 123, "name": "foo"}
```

#### model.toObject([`scope`[, `raw`]]) -> `{}`

Returns a hash of the model's transformed attributes that are included by `scope`. If `scope` is not defined, all attributes will be included. If `raw` is set to `true`, the result object will not be passed through `output` mutation.

| Description       | Type       | Required | Default |
|:------------------|:-----------|:---------|:--------|
| Scope name        | `string`   | No       |         |
| Return raw value? | `boolean`  | No       | `false` |

```js
var Book = orm.createClass('Book', {
  properties: {
    id: {
      primary: true,
      type: 'number'
    },
    name: {
      type: 'string'
    },
    isbn: {
      type: 'number'
    }
  },
  scopes: {
    onlyName: ['id', 'name']
  }
});

var book = Book.create({name: 'foo', isbn: 123});
var data = book.toObject();
var nameData = book.toObject('onlyName');

console.log(data); // -> {"id": 2, "name": "foo", "isbn": 123}
console.log(nameData); // -> {"id": 2, "name": "foo"}
```

#### model.save([`req`,]`cb`) -> `Instance`

Save can be called on any model instance. If the model instance does not have a set primary key, the orm will automatically generate and assign one to the model instance using `generateId`. `cb` will immediately return an error if the model is invalid.

| Description    | Type       | Required |
|:---------------|:-----------|:---------|
| Access request | `{}`       | No       |
| Callback       | `function` | Yes      |

```js
// Saving without a primary key:
var book1 = Book.create({isbn: 123, name: 'foo'});
book1.save(function(err) {
  if (err) {
    console.error('Failed to save the model:', err);
  } else {
    console.log('Successfully saved the model.');
    console.log(book1.get('id')); // An id is automatically generated.
  }
});

// Saving with a primary key:
var book2 = Book.create({id: 3, isbn: 456, name: 'bar'});
book2.save(function(err, model) {
  if (err) {
    console.error('Failed to save the model:', err);
  } else {
    console.log('Successfully saved the model.');
    console.log(book2.get('id')); // Prints the manually assigned id.
  }
});
```

#### model.fetch([`req`, [`scope`,]] `cb`)

Fetches a model with the given scope. If `scope` is not defined, all attributes will be included. This method can only be called on model instances that have a set primary key. `cb` will immediately return an error if the model is invalid or if the model has no primary attribute value.

| Description    | Type       | Required |
|:---------------|:-----------|:---------|
| Access request | `{}`       | No       |
| Scope name     | `string`   | No       |
| Callback       | `function` | Yes      |

```js
var book = Book.get(2);
book.fetch('onlyName', function(err) {
  if (err) {
    console.error('Failed to fetch the model:', err);
  } else {
    console.log('Fetched book:', book.get('name')); // -> "foo"
  }
});
```

#### model.destroy([`req`,] `cb`)

Removes all model references. If model's `options.softDelete` is not set to `true`, the model is permanently deleted from the datastores. This method can only be called on model instances that have a set primary key. `cb` will immediately return an error if the model is invalid or if the model has no primary attribute value.

| Description    | Type       | Required |
|:---------------|:-----------|:---------|
| Access request | `{}`       | No       |
| Callback       | `function` | Yes      |

```js
var book = Book.get(2);
book.destroy(function(err) {
  if (err) {
    console.error('Failed to destroy the model:', err);
  } else {
    console.log('Successfully destroyed the model.');
  }
});
```

#### model.incr(`attribute`, `amount`)

Atomically increments `attribute` by `amount`.

#### model.decr(`attribute`, `amount`)

Atomically decrements `attribute` by `amount`.

#### model.isValid() -> `bool`

Returns a boolean value indicating if the model is valid.

#### model.inputErrors -> `{}`

Contains all input errors.
