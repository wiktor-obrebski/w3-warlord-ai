# Warcraft III API declarations

Scoped TypeScript declarations for the Warcraft III API.

## Declarations

Use `war3-types-strict` as the reference for API names, parameters, and TypeScript signatures.

Do not blindly copy its nullability. It conservatively marks many handle/reference returns as `| undefined`, even when no real failure case is documented.

For example, use:

```ts
export function CreateGroup(): group;
```

not:

```ts
export function CreateGroup(): group | undefined;
```

Use `null` when a Warcraft API is documented to return JASS `null`:

```ts
unit | null
```

Use `void` for functions that return nothing.

When nullability is unclear, check Jassdoc and documented runtime behavior.

## Documentation

Every new API declaration should include JSDoc based on:

```bash
bin/jassdoc/jassdoc.sh <symbol>
```

Preserve useful descriptions and tags such as `@param`, `@note`, `@bug`, and `@patch`.

Use Jassdoc for documentation and semantic behavior. Use `war3-types-strict` for the TypeScript declaration shape.

## Modules

Add declarations to the appropriate scoped module, for example:

```ts
@lib/warcraft3-api/player
@lib/warcraft3-api/unit
@lib/warcraft3-api/ui
```

Application code should use namespace imports:

```ts
import * as UnitApi from "@lib/warcraft3-api/unit";

UnitApi.KillUnit(unit);
```

Do not use named imports or import `war3-types-strict` directly in application code.

## Runtime

These modules contain declarations only.

`@lib/warcraft-tstl-plugin` removes their imports and rewrites calls to Warcraft III globals during TSTL compilation.

Do not add runtime implementations.
