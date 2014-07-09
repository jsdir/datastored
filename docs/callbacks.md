# Callbacks

Defines actions to perform at different times in the model's lifecycle.

- initialize
- beforeFetch
- afterFetch
- beforeSave
- afterSave
- beforeDestroy
- afterDestroy

Model callbacks are defined in model options as the `callbacks` option. Datastored binds each callback to the model instance.

### initialize: func(options) -> options

Return modified `options`.

### beforeFetch: func(req, attributes, cb)

Call `cb` with modified `attributes`.

### afterFetch: func(req, values, cb)

Call `cb` with modified `values`.

### beforeSave: func(req, values, cb)

Call `cb` with modified `values`.

### afterSave: func(req, values, cb)

Call `cb` with modified `values`.

### beforeDestroy: func(cb)

### afterDestroy: func(cb)
