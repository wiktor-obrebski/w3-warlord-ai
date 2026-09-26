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

Declarations are currently maintained manually.

`war3-types-strict` should be treated as the reference for Warcraft III types and native function signatures.

When adding a Warcraft API function, copy its type signature from `war3-types-strict` into the appropriate module.

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
