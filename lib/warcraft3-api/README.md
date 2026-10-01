# @lib/warcraft3-api

Scoped TypeScript declarations for the Warcraft III API.

This package exists to avoid exposing the entire `war3-types-strict` API as globals throughout the project.

Instead of:

```ts
Player(0);
DisplayTextToPlayer(...);
```

application code uses explicit API modules:

```ts
import * as PlayerApi from "@lib/warcraft3-api/player";
import * as UiApi from "@lib/warcraft3-api/ui";

const player = PlayerApi.Player(0);

UiApi.DisplayTextToPlayer(
  player,
  0,
  0,
  "Hello",
);
```

## Runtime behavior

This package contains declarations only.

There are no corresponding Lua modules at runtime.

`@lib/warcraft-tstl-plugin` removes these imports during TSTL compilation and rewrites:

```ts
PlayerApi.Player(0);
```

to:

```lua
Player(0)
```

## Declarations

Declarations are maintained manually.

`war3-types-strict` is the reference for Warcraft III types and native function signatures.

When adding a new Warcraft API declaration:

1. Copy the TypeScript type signature from `war3-types-strict`.
2. Use `bin/jassdoc/jassdoc.sh` to retrieve the corresponding Jassdoc documentation.
3. Add the Jassdoc-derived documentation as JSDoc above the declaration.
4. Place the declaration in the appropriate API module.

Example:

```bash
bin/jassdoc/jassdoc.sh GroupEnumUnitsOfPlayer
```

The Jassdoc output includes the original JASS declaration together with documentation such as descriptions, parameters, notes, bugs, and patch information.

The TypeScript signature must still come from `war3-types-strict`. Jassdoc is used as the documentation source, not as the source of TypeScript types.

Every newly added Warcraft API function should include JSDoc based on the Jassdoc output when documentation is available.

## Usage

Use namespace imports:

```ts
import * as UnitApi from "@lib/warcraft3-api/unit";

UnitApi.KillUnit(unit);
```

Types can be accessed through the same namespace:

```ts
import * as PlayerApi from "@lib/warcraft3-api/player";

function handlePlayer(player: PlayerApi.player) {
  const id = PlayerApi.GetPlayerId(player);
}
```

Avoid direct use of `war3-types-strict` in application code, because that would expose its global declarations again.

Also avoid named imports:

```ts
import { Player } from "@lib/warcraft3-api/player";
```

The supported form is:

```ts
import * as PlayerApi from "@lib/warcraft3-api/player";
```
