# Math

## Vector2

A small, dependency-free `Vector2` implementation intended for TypeScriptToLua (TSTL).

The public API is intentionally based on the useful, non-rendering subset of [`THREE.Vector2`](https://threejs.org/docs/#Vector2). Supported methods keep the same names, mutation behavior, argument order, and return semantics so the Three.js `Vector2` documentation can be used as the primary API reference for those methods.

This package does **not** depend on Three.js and does not require a JavaScript runtime. The implementation is plain TypeScript designed to be compiled by TSTL.

### Usage

```ts
import { Vector2 } from '@lib/math';

const worker = new Vector2(100, 200);
const enemy = new Vector2(300, 250);

const escapeDirection = worker
  .clone()
  .sub(enemy)
  .normalize();

const escapePoint = worker
  .clone()
  .addScaledVector(escapeDirection, 300);
```

Like Three.js, most operations mutate the vector and return `this`:

```ts
const position = new Vector2(10, 20);
position.add(new Vector2(5, 2)).multiplyScalar(2);
```

Use `clone()` when the original value must remain unchanged.

### Supported Three.js-compatible API

#### Construction and assignment

- `new Vector2(x?, y?)`
- `x`, `y`
- `set(x, y)`
- `setScalar(scalar)`
- `setX(x)`
- `setY(y)`
- `clone()`
- `copy(v)`

#### Arithmetic

- `add(v)`
- `addScalar(s)`
- `addVectors(a, b)`
- `addScaledVector(v, s)`
- `sub(v)`
- `subScalar(s)`
- `subVectors(a, b)`
- `multiply(v)`
- `multiplyScalar(scalar)`
- `divide(v)`
- `divideScalar(scalar)`
- `negate()`

#### Limits and rounding

- `min(v)`
- `max(v)`
- `clamp(min, max)`
- `clampScalar(minVal, maxVal)`
- `clampLength(min, max)`
- `floor()`
- `ceil()`
- `round()`
- `roundToZero()`

#### Vector algebra and geometry

- `dot(v)`
- `cross(v)`
- `lengthSq()`
- `length()`
- `manhattanLength()`
- `normalize()`
- `angle()`
- `angleTo(v)`
- `distanceTo(v)`
- `distanceToSquared(v)`
- `manhattanDistanceTo(v)`
- `setLength(length)`
- `lerp(v, alpha)`
- `lerpVectors(v1, v2, alpha)`
- `equals(v)`
- `rotateAround(center, angle)`

### Intentionally omitted Three.js API

The following `THREE.Vector2` features are intentionally not implemented because they are tied to rendering/data interoperability or provide little value to a Warcraft III AI:

- `width` / `height` aliases — rendering-oriented aliases for `x` / `y`.
- `isVector2` — Three.js runtime type-testing convention.
- `setComponent()` / `getComponent()` — index-based component access adds little value for 2D bot geometry.
- `applyMatrix3()` — transformation-matrix integration is not needed for WC3 world-space calculations.
- `fromArray()` / `toArray()` — array serialization convenience is unnecessary for current bot logic.
- `fromBufferAttribute()` — Three.js rendering-buffer integration.
- `random()` — bot randomness should be explicit and controlled outside the vector primitive.
- `[Symbol.iterator]()` — unnecessary iteration support and undesirable extra runtime machinery for TSTL.

If one of these becomes useful later, it can be added while preserving the corresponding Three.js semantics.

### Compatibility contract

This is a **subset-compatible API**, not a replacement for Three.js.

For every supported method, the intent is to match `THREE.Vector2` behavior closely enough that the official documentation applies directly:

https://threejs.org/docs/#Vector2

The implementation itself is independent and dependency-free; Three.js is used as the API and behavioral reference.
