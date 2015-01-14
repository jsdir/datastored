Instance
========

An `Instance` is an instantiated `Model`.

```js
Book.find({isbn: 1234567890})
  .then(function(user) {
    if (user !== null) {
      console.log('Found instance: ', user);
    }
  }, function(err) {
    throw err;
  });
```

## Attribute Requests

Both the `get` and `fetch` methods use Attribute Requests to define required data. The request can be used in several ways:

- Request one attribute: `'isbn'`
- Request multiple attributes: `['isbn', 'title']`
- Request multiple attributes with options:

  ```
  {
    isbn: true,
    title: true,
    owner: ['first_name', 'last_name']
  }
  ```

## Methods

### `instance.save(data[, options])`

Validates attribute `rules` and `required`. The instance is persisted to `HashStore`s and `IndexStore`s. `data` is transformed with the save transform set.

- `data` (object, required)
- `options` (object, optional)
  - `user` = false (boolean, optional)

- Returns: `Promise` to be fulfilled with `Instance`

### `instance.fetch(attributes[, options])`

Fetches attributes and optionally outputs them asynchronously. Fetched data is always transformed with the fetch transform set.

- `attributes` ({array, object}, required) ... A valid Attribute Request
- `options` (object, optional)
  - `reload` = false (boolean, optional)

    If set to `false`, `fetch` will not fetch any attributes that are already loaded. If set to `true`, `fetch` will fetch all attributes regardless of whether or not they are already loaded.

  - `output` = true (boolean, optional)

    If set to `true`, `fetch` will transform the data with the output transform set and will return a `Promise` this is fulfilled with the transformed data. If set to `false`, `fetch` will not transform the data or return a `Promise`. This is useful for preventing the fetched values from being further transformed if they are not immediately needed.

- Returns: `Promise` to be fulfilled with output values if `options.output` is `true`

### `instance.get(attributes[, options])`

Outputs fetched attributes synchronously. Output data is transformed with the output transform set.

- `attributes` ({array, object}, required) ... A valid Attribute Request
- `options` (object, optional)
  - `user`

- Returns: Attribute values

### `instance.getId([options])`

Returns the instance id. If the instance is not saved, `null` is returned.

- `options` (object, optional)
  - `user` = false (boolean, optional)

- Returns: {string, integer, `null`}
