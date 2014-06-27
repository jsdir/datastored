# Models

## Defining a model

A model can be defined with `orm.createModel`. `orm.createModel` is called with the model name and options.

```js
var orm = require('./orm');

var Book = orm.createModel('Book', {
  column: 'books',
  schema: {
    id: {
      type: 'number'
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

#### schema

**(required)** Defines the model's properties.

#### extends

Allows the model to extend the definition of another model.

#### marshaller

Defines the marshaller to use for the model. This will override the orm's `options.modelMarshaller`.

#### relations

Defines the model's relations. Relations are described [here](relations.md) in further detail.

#### scopes

Defines the model's scopes.

#### softDelete

When set to `true`, only references will be destroyed when a model is deleted. The model itself will not be deleted from the datastores. Defaults to `false`.

#### transforms

Defines the model's transforms. Transforms are described [here](transforms.md) in further detail.

#### methods

Defines methods for the model instance. This option will overwrite any existing instance methods on conflict.

#### staticMethods

Defines methods for the model constructor. This option will overwrite any existing static methods on conflict.

## Schema

Schema describes model properties and their values. Every model has a default primary `id` property that uses the orm's `generateId` to set the value. This property can be overridden.

Because they have their own options, properties are defined with the names as keys and the options as values:

```js
schema: {
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

### Attribute options

#### type

**(required)** Defines the property type. This is used by marshallers to serialized the value to the correct formats.

#### primary

When set to `true`, the property will be used as the model's primary key. Since a model can have only one primary key, only one property can be `primary`. Defaults to `false`.

#### index

Unlike the `primary` option, any property can become indexed if `index` is set to `true`. Using indexes is the only way to ensure uniqueness in datastored. Defaults to `false`.

#### cached

When set to `true`, the property will be cached. Defaults to `false`.

#### rules

Defines the property's rules. Rules are described [here](rules.md) in further detail.

## Extending a model

Multiple model types can be classified under a parent model. The model types will be stored in the parent model's column.

## Static Methods

Static methods are called on the model class.

For most of these methods, the callback is optional. If a callback is not specified, the method will return a chainable object. Also, many of these methods have a `raw` parameter. Set `raw` to `true` when you know the values that you are putting into the model and to `false` when using values from user input.

#### .create(`attributes`[, `raw`])

Will construct a new instance of the model with `attributes`. If `raw` is set to `false`, `attributes` will be passed through the `input` transform chain and will also be deserialized.

| Description         | Type       | Required | Default |
|:--------------------|:-----------|:---------|:--------|
| Model attributes    | `{}`       | Yes      |         |
| Use raw attributes? | `boolean`  | No       | `true`  |

```js
var book = Book.create({isbn: 123});
```

#### .get(`pk`[, `raw`])

Gets a model from a primary key. This method does not fetch from any datastores, it is just a convenience method that creates a new model and assigns the primary key to `pk`. If `raw` is set to `false`, `pk` will be passed through the `input` transform chain and will also be deserialized.

| Description         | Type      | Required | Default |
|:--------------------|:----------|:---------|:--------|
| Primary key         | `*`       | Yes      |         |
| Use raw attributes? | `boolean` | No       | `true`  |

```js
var book = Book.get(2);
```

#### .find(`query`[, `raw`], `callback`)

Finds any model that matches `query`. `query` is a hash with attribute names as keys and attributes values as values. If `raw` is set to `false`, `query` will be passed through the `input` transform chain and will also be deserialized.

| Description         | Type       | Required | Default |
|:--------------------|:-----------|:---------|:--------|
| Query               | `{}`       | Yes      |         |
| Use raw attributes? | `boolean`  | No       | `true`  |
| Callback            | `function` | True     |         |

```js
Book.find({isbn: 123}, function(err, book) {
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

#### .set(`attributes`[, `raw`])

Set `attributes` and overwrites existing ones on conflict. If `raw` is set to `false`, `attributes` will be passed through the `input` transform chain and will also be deserialized.

| Description         | Type       | Required | Default |
|:--------------------|:-----------|:---------|:--------|
| Model attributes    | `{}`       | Yes      |         |
| Use raw attributes? | `boolean`  | No       | `true`  |

```js
book.set({name: 'foo', isbn: 123});
```

##### Alternative usage: .set(`name`, `value`[, `raw`])

The alternative usage can be used to set a single attribute.

| Description         | Type      | Required | Default |
|:--------------------|:----------|:---------|:--------|
| Attribute name      | `string`  | Yes      |         |
| Attribute value     | `*`       | Yes      |         |
| Use raw attributes? | `boolean` | No       | `true`  |

```js
book.set('isbn', 123);
```

#### .get(`attribute`[, `raw`])

Gets the value of `attribute`. If `raw` is set to `false`, the result will be passed through the `output` transform chain and will also be serialized.

| Description       | Type      | Required | Default |
|:------------------|:----------|:---------|:--------|
| Attribute name    | `string`  | Yes      |         |
| Return raw value? | `boolean` | No       | `true`  |

```js
var name = book.get('name');
console.log(name); // -> "foo"
```

##### Alternative usage: .get(`attributes`[, `raw`])

The alternative usage can be used to get multiple `attributes`.

| Description       | Type      | Required | Default |
|:------------------|:----------|:---------|:--------|
| Attribute names   | `array`   | Yes      |         |
| Return raw value? | `boolean` | No       | `true`  |

```js
var data = book.get(['isbn', 'name']);
console.log(data); // -> {"isbn": 123, "name": "foo"}
```

#### model.toObject([`scope`[, `raw`]])

Returns a hash of the model's transformed attributes that are included by `scope`. If `scope` is not defined, all attributes will be included. If `raw` is set to `false`, the result will be passed through the `output` transform chain and will also be serialized.

| Description       | Type       | Required | Default |
|:------------------|:-----------|:---------|:--------|
| Scope name        | `string`   | No       |         |
| Return raw value? | `boolean`  | No       | `true`  |

```js
var Book = orm.createClass('Book', {
  schema: {
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

#### model.save([`req`,]`cb`)

Save can be called on any model instance. If the model instance does not have a set primary key, the orm will automatically generate and assign one to the model instance using `generateId`.

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

Fetches a model with the given scope. If `scope` is not defined, all attributes will be included. This method can only be called on model instances that have a set primary key.

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

Removes all model references. If model's `options.softDelete` is not set to `true`, the model is permanently deleted from the datastores. This method can only be called on model instances that have a set primary key.

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
