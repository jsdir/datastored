# Link Tests

## HasOne

- l.1 [1:1]
  - adding item should change A1.attribute and A2.attribute to A1
  - switching item should change A1.attribute, A2.attribute to null, and A3.attribute to A1
  - removing item should change A1.attribute to null, and A3.attribute to null

  - test the above inverted, B -> A (both sides of the link)

- j.1
  - have two linked instances each with joined props. change props on both instances and check
  if they are changed on each other.

- j.2 [1:1]
  - test that joined attributes on both instances for first associaiton and second link


## HasMany

- l.1 [1:n] (only RedisZSet/Set for now)
  - adding item to set will change child link to parent
  - removing item from set will change child link to null

  - test the above inverted (both side of the link):

  - setting child.link to a parent will add it to the parent hasMany
  - setting child.link to another parent will remove it from the existing and add to the new
  - setting child.link to null will then remove it from the parent

- l.1 [n:n] (only RedisZSet/Set for now)
  - one side of the link (test for related membership)
  - other side of the link (test for related membership])

- j [1:n]
  - let children have joined properties of a parent
  - adding item to set will set child joined props to the parent joined props
  - removing is understood (since joined joined props are stored in the id)

  - test the other side of the link

  - setting child.link to a parent will copy its joined props
  - setting child.link to another parent will copy its joined props
  - again, removing is understood and assumed

next iteration, merge joined prop tests into normal tests since they are similar, fewer tests means less maintenance

## HasMany with Tree

-
  - add a descendant N to a tree, the root ref should change for N and all descendants of N, include joined props
  - add descendant to new tree, the root ref should change for N and all descendants, include joined props

  - changing root ref on a subtree root N should change rootRef for all descendants, and joinedProps for N and all descendants
  - changing root ref to null should do the same, changing the values to null

- changing joined attributes on root should change joined attributes on all descendants
