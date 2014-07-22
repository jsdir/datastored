# Callbacks

Defines actions to perform at different times in the model's lifecycle.

- initialize

- beforeOutput
- afterOutput

- beforeInput
- afterInput

- beforeFetch
- afterFetch

- beforeSave
- afterSave

- beforeDestroy
- afterDestroy

Model callbacks are defined in model options as the `callbacks` option. Datastored binds each callback to the model instance.

### initialize: func(options) -> options

Return modified `options`.

### beforeOutput: func(values) -> values

Methods to perform before internal mutations like unserialization and hidden value filtering. During extension, functions from different option partials are composed in reverse compared to `beforeInput` to preserve the mixin layering.

### afterOutput: func(values) -> values

Methods to perform after internal mutations like unserialization and hidden value filtering. During extension, functions from different option partials are composed in reverse compared to `afterInput` to preserve the mixin layering.

### beforeInput: func(values, cb)

Methods to perform before internal mutations like serialization and immutability filtering. Must call `cb(err, values)` synchronously.

### afterInput: func(values, cb)

Methods to perform after internal mutations like serialization and immutability filtering. Must call `cb(err, values)` synchronously.

### beforeFetch: func(options, attributes, cb)

Calls `cb(err, options, attributes)`.

### afterFetch: func(options, values, cb)

Calls `cb(err, options, values)`.

### beforeSave: func(options, values, cb)

Calls `cb(err, options, values)`.

### afterSave: func(options, values, cb)

Calls `cb(err, options, values)`.

### beforeDestroy: func(options, cb)

Calls `cb(err, options)`.

### afterDestroy: func(options, cb)

Calls `cb(err, options)`.
