# Warcraft III API declarations

This directory contains scoped TypeScript declarations for the Warcraft III API.

## Source of truth

Use `war3-types-strict` as the source of truth for:

- TypeScript types
- function signatures
- parameter types
- return types
- nullability

Do not reconstruct TypeScript signatures from JASS declarations.

## Documentation

Every newly added Warcraft III API declaration should include JSDoc based on Jassdoc when documentation is available.

Use:

```bash
bin/jassdoc/jassdoc.sh <symbol>
```

Example:

```bash
bin/jassdoc/jassdoc.sh GroupEnumUnitsOfPlayer
```

Preserve useful Jassdoc information.
Use Jassdoc only as the documentation source. 
The TypeScript declaration must still follow `war3-types-strict`.

## Module structure

Add declarations to the most appropriate scoped API module, such as:

```ts
@lib/warcraft3-api/player
@lib/warcraft3-api/unit
@lib/warcraft3-api/ui
```

Do not expose the full `war3-types-strict` declaration set globally.

## Imports

Application code should use namespace imports:

```ts
import * as UnitApi from "@lib/warcraft3-api/unit";

UnitApi.KillUnit(unit);
```

Types should be accessed through the same namespace:

```ts
import * as PlayerApi from "@lib/warcraft3-api/player";

function handlePlayer(player: PlayerApi.player) {}
```

Do not use named imports from these API modules:

```ts
import { KillUnit } from "@lib/warcraft3-api/unit";
```

Do not import `war3-types-strict` directly in application code.

## Runtime

These modules are declarations only. They do not exist as Lua modules at runtime.

`@lib/warcraft-tstl-plugin` removes the namespace imports and rewrites API calls to their Warcraft III global equivalents during compilation.

Do not add runtime implementations for these declarations.
