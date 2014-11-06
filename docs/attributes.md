Attribute API
=============

In datastored, models are defined with attributes. Every valid attribute exposes an API that defines its interaction with the parent instance.

```js
var Model = orm.createModel('Model', {
  attributes: {
    foo: Attribute({bar: 'baz'})
  }
})
```

### Attribute Options

#### `required`

Boolean value. Default `false`. Set to `true` if the attribute must be defined before saving a new instance.

#### `hashStores`

An array of `HashStores` to save the attribute to.

#### `indexStore`

An `IndexStore` to index the instance.

#### `replaceIndex`

Boolean value. Default `false`. Set to `true` to overwrite old indexes when the value changes.

#### `guarded`

Boolean value. Default `false`. Set to `true` to prevent the user from setting this attribute.

#### `hidden`

Boolean value. Default `false`. Set to `true` to prevent the user from viewing this attribute.

#### `defaultValue`

The default value to set when the instance is created.

#### `type`

The valids-compatible type for use in the datastore marshallers.

#### `rules`

The valids-compatible rules to use when validating the attribute.

#### `hasMutableValue`

Boolean value. Default `true`. Set to `false` to make the attribute completely immutable and representational. 

### Waiting for the loaded ORM

If the orm needs to be accessed when all of its models are loaded to performs things like cross-model link checking and other validations, the attribute can instead be a function that accepts the orm as its first parameter and returns the attribute object:

```js
function Attribute(options) {
  // This function will be called by the orm when all of the models are loaded.
  return function(orm) {
    // Use `orm` to check `options`.
    return {
      type: 'string'
    };
  }
}
```

