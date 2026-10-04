# `@lib/math`

Small, dependency-free 2D math primitives for the Warlord Warcraft III bot.

The library deliberately distinguishes **points** from **vectors**:

- `Point` represents a position in the game world.
- `Vector` represents a displacement, direction, or magnitude.

This distinction is intentional. A point is not treated as a vector merely because both contain `x` and `y` coordinates.

## Inspiration

The API is based on the `Point` and `Vector` concepts from [FlattenJS (`@flatten-js/core`)](https://github.com/alexbol99/flatten-js), with only the subset useful to Warlord retained.

FlattenJS documentation:

- [Full documentation](https://alexbol99.github.io/flatten-js/)
- [Point](https://alexbol99.github.io/flatten-js/Point.html)
- [Vector](https://alexbol99.github.io/flatten-js/Vector.html)

`@lib/math` does **not** depend on FlattenJS. It is a small TypeScript implementation intended to compile cleanly with TypeScriptToLua.

## Semantics

The important operations preserve the mathematical distinction between points and vectors:

```text
Point + Vector = Point
Point - Point = Vector
Vector + Vector = Vector
Vector - Vector = Vector
Vector * scalar = Vector
```

`Point - Point` is represented by constructing a vector from two points:

```ts
const direction = new Vector(start, target);
```

`Point + Vector` is represented by translation:

```ts
const target = start.translate(displacement);
```

Points deliberately do not expose vector operations such as `normalize`, `dot`, `add`, or `multiply`.

## Example

Move from point `A` in direction `(1, 2)` by distance `3`:

```ts
import { Point, Vector } from "@lib/math";

const a = new Point(10, 20);
const direction = new Vector(1, 2);

const displacement = direction.normalize().multiply(3);
const target = a.translate(displacement);
```

To calculate the direction from one position to another:

```ts
const unitPosition = new Point(10, 20);
const enemyPosition = new Point(30, 50);

const toEnemy = new Vector(unitPosition, enemyPosition);
const direction = toEnemy.normalize();
const distance = toEnemy.length;
```

## `Point`

Supported API:

```ts
new Point(x?, y?)
point.clone()
point.equalTo(other)
point.translate(vector)
```

`Point` is immutable. Operations return new objects.

## `Vector`

Construction:

```ts
new Vector()
new Vector(x, y)
new Vector(startPoint, endPoint)
```

Supported API:

```ts
vector.clone()

vector.slope
vector.length
vector.isZeroLength()
vector.equalTo(other)

vector.multiply(scalar)
vector.add(other)
vector.subtract(other)
vector.invert()

vector.dot(other)
vector.cross(other)
vector.normalize()
vector.angleTo(other)
vector.projectionOn(other)

vector.rotate(angle)
vector.rotate90CCW()
vector.rotate90CW()
```

`Vector` is immutable. Operations return new vectors rather than modifying the receiver. This follows FlattenJS's vector behavior and makes intermediate calculations easier to reason about in AI code.

Angles are in radians. `slope` and `angleTo()` return values in the range `[0, 2π)`.

## Floating-point comparisons

`equalTo()` and zero-length checks use a tolerance of `0.000001`, matching FlattenJS's default floating-point tolerance.

## Deliberately omitted FlattenJS API

FlattenJS is a full computational-geometry library. Warlord currently needs only basic position and vector algebra, so this library intentionally does not implement:

- matrices and generic affine transforms
- arbitrary shapes, segments, lines, circles, polygons, etc.
- SVG/rendering helpers
- serialization helpers
- bounding boxes
- shape intersections and spatial relations
- `Point.distanceTo(shape)` and shortest-segment calculations
- point ordering (`lessThan`)
- generic `scale`, `rotate`, or `transform` operations on points
- translation of vectors

The subset should remain small. Additional operations should be added when Warlord has a concrete use for them.
