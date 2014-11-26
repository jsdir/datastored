Data Flow
=========

In datastored, "data" refers to the attribute values of an instance. All of datastored is basically a set of wrappers, utilities, and tools to get, change, and transform this data in a semantic way.

## Attribute Transforms

Below is a list of the different pipelines where data may flow. The data transforms are listed in the order they are applied.

- input
  + [user input transforms](security.md) (if applyUserTransforms is `true`)
  + model input
  + attribute input
- output (sync/async, options)
  + attribute output (loop)
  + model output (loop)
  + [user output transforms](security.md) (if applyUserTransforms is `true`)

`input` and `output` are inverses. Their transforms should cancel out each other.

- fetch (options)
  + attribute fetch
  + model fetch
- save
  + check for required attributes
  + validation according to attribute rules
  + model save
  + attribute save
