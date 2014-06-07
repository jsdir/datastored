Transforms
==========
Datastored has a unique approach to managing data flow.

  - input
  - output
  - fetch
  - save

A diagram of the transform chains in the datastored pipeline:

```
+------------+  fetch  +-------+  output  +------+
|            |-------->|       |--------->|      |
| Datastores |  save   | Model |  input   | User |
|            |<--------|       |<---------|      |
+------------+         +-------+          +------+
```

Each transform chain handles a different part of ORM functionality:

#### input
- unserializes data from JSON

#### output
- hides attributes marked as hidden
- serializes data to JSON

#### save
- Validates data.


validate
marshal
hide
lowercase
alias
