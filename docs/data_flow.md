Data Flow
=========

In datastored, "data" refers to the attribute values of an instance. Datastored is basically a set of wrappers, utilities, and tools to get, change, and transform this data in semantic ways.

## Attribute Transforms

Below is a list of the different transform sets that are applied to data. The data transforms are listed in the order they are applied.

- input
  - [user input transforms](security.md) (if `options.user` is `true`)
  - model input
  - attribute input
- output
  - attribute output
  - model output
  - [user output transforms](security.md) (if `options.user` is `true`)
- fetch
  - attribute fetch
  - model fetch
- save
  - check for required attributes
  - validate attributes according to attribute constraints
  - model save
  - attribute save
