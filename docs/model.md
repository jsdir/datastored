Model
=====


Options
-------

- `table`
- `transforms`
- `attributes`
- `relations`: Relations are described [here](relations.md) in further detail.
- `methods`
- `staticMethods`

Although highly unrecommended, `staticMethods` and `methods` will overwrite any existing methods that have the same name.


Static Methods
--------------

Static methods are called on the model class.

#### Model.create(attrs)

The id can optionally be assigned in `attrs`. If the id is not assigned, datastored will automatically generate on with the orm's `idGenerator`.

#### Model.get(pk)

This gets a model from a primary key. This method does not fetch from any datastores, it is just a convenience method that creates a new model and assigns the primary key to `pk`.

#### Model.find(query, cb)

`find(query)` finds any model that matches `query`. `query` is a hash that maps attribute name to value.

```js
Book.find({isbn: 1234567890}, function(err, book) {
  if (err) {
    console.error('There was an error when finding the model.');
  } else {
    console.log('Found the book:', book);
  }
});
```


Instance Methods
----------------

Instance methods can be called on model instances.

#### model.set(attr, value)

```js
model.set('isbn', 12345);
```

`model.set` can also be called with a hash mapping attribute names to values.

```js
model.set({isbn: 12345, name: 'foo'});
```

#### model.get(attr)

```js
var name = model.get('name');
console.log(name); // => "foo"
```

`model.get` can also be called with an array of attribute names:

```js
var data = model.get(['name', 'isbn']);
console.log(data); // => {isbn: 12345, name: 'foo'}
```

#### model.save(cb)

Save can be called on any model instance. If the model instance does not have a set primary key, the ORM will automatically generate and assign one to the instance using the `idGenerator`.

```js
// Saving without a primary key:
var book = Book.create({isbn: 123, name: 'foo'});
book.save(function(err, model) {
  if (err) {
    console.error('Failed to save the model.');
  } else {
    console.log('Successfully saved the model.');
    console.log(model.get('id')); // An id is automatically generated.
  }
});

// Saving with a primary key:
var book = Book.create({id: "a23d2e02f", isbn: 456, name: 'bar'});
book.save(function(err, model) {
  if (err) {
    console.error('Failed to save the model.');
  } else {
    console.log('Successfully saved the model.');
    console.log(model.get('id')); // Prints the manually assigned id.
  }
});
```

#### model.fetch(scope, cb)

This method can only be called on model instances that have a set primary key.

```js
var book = Book.get(1234567890);
book.fetch('basic', function(err, book) {
  if (err) {
    console.error('Failed to fetch the model.');
  } else {
    console.log('Fetched the book:', book);
  }
});
```

#### model.destroy(cb)

This method can only be called on model instances that have a set primary key.

```js
var book = Book.get(1234567890);
book.destroy(function(err) {
  if (err) {
    console.error('Failed to destroy model.');
  } else {
    console.log('Successfully destroyed the model.');
  }
});
```
