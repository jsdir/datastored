# Instance

## Methods

### `instance.fetch(attributes)`

Fetches attribute values from defined hash stores.

- Parameters
  + attributes (required, {string, array, object})

    If `attributes` is a string, the orm with fetch one attribute as that name. If `attributes` is an object, the keys are the attribute names and the values are the attribute fetch options. If the attribute object has an attribute without options, the options can be set to `true`.

```js
// Fetch attributes.
instance.fetch(['foo', 'bar']);
// Fetch attributes with options.
instance.fetch({foo: {option: 'value'}, bar: true});
```

- Returns: `Promise`

### `instance.save(attributes)`

Validates attribute `rules` and `required`. Persists the instance to the data stores.

- Parameters:
  + attributes (required, object) ... Attribute values.

- Returns: `Promise` 

### `instance.get(attributes, applyUserTransforms)`

Returns attribute values.

- Parameters:
  + attributes (required, {string, array, object})

    - `'attributeName'` => `'attributeValue'`
    - `['attribute1Name', 'attribute2Name']` => `{attribute1Name: attribute1Value, attribute2Name: attribute2Value}`
    - `{attribute1Name: true, attribute2Name: attribute2Options}` => `{attribute1Name: attribute1Value, attribute2Name: attribute2Value}`

  + applyUserTransforms = `false` (optional, boolean) ... Set to `true` to [apply user transforms](security.md) to the returned id value.

- Returns:
  + Promise when any of the requested attributes are asynchonous. The promise is fulfilled with the attribute data.
  + Object when requesting multiple, synchronous attributes.
  + Value when requesting a single, synchronous attribute.

### `instance.getId(applyUserTransforms)` 

Returns the instance id. If the instance is not saved, `null` is returned.

- Parameters:
  + applyUserTransforms = `false` (optional, boolean) ... Set to `true` to [apply user transforms](security.md) to the returned id value.

- Returns: {string, integer}
