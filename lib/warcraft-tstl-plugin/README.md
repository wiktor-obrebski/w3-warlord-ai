# @lib/warcraft-tstl-plugin

TSTL plugin used to expose Warcraft III native APIs through scoped TypeScript modules without generating Lua module imports.

## Purpose

Warcraft III APIs are runtime globals such as:

```ts
Player(0);
DisplayTextToPlayer(...);
CreateUnit(...);
```

The corresponding TypeScript typings from `war3-types-strict` are also global, which makes the entire Warcraft API available everywhere in the project.

This project instead exposes Warcraft APIs through scoped modules such as:

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

At runtime, however, there is no `PlayerApi` or `UiApi` Lua module. Warcraft still provides these functions as globals.

This plugin bridges that difference.

The code above is emitted approximately as:

```lua
local player = Player(0)

DisplayTextToPlayer(
    player,
    0,
    0,
    "Hello"
)
```

## What the plugin does

The plugin recognizes imports from:

```text
@lib/warcraft3-api
@lib/warcraft3-api/*
```

For example:

```ts
import * as UnitApi from "@lib/warcraft3-api/unit";
```

It performs two transformations.

### Removes the runtime import

Normally TSTL would emit a Lua `require` for the import.

The plugin removes it completely.

There is therefore no runtime module named:

```text
@lib/warcraft3-api/unit
```

### Rewrites namespace accesses to Warcraft globals

For an import such as:

```ts
import * as UnitApi from "@lib/warcraft3-api/unit";
```

this:

```ts
UnitApi.KillUnit(unit);
```

is emitted as:

```lua
KillUnit(unit)
```


## Supported import style

Use namespace imports:

```ts
import * as PlayerApi from "@lib/warcraft3-api/player";
```

Do not use named imports:

```ts
import { Player } from "@lib/warcraft3-api/player";
```

The plugin currently relies on recognizing the namespace object and rewriting accesses such as:

```ts
PlayerApi.Player(...)
```

## Type declarations

The plugin only affects TSTL output.

TypeScript still needs declaration files describing each Warcraft API module.

For example:

```ts
declare module "@lib/warcraft3-api/player" {
  export interface player extends agent {
    __player: never;
  }

  export function Player(index: number): player;

  export function GetPlayerId(
    whichPlayer: player,
  ): number;
}
```

These declarations are provided separately by `@lib/warcraft3-api`.

## TSTL configuration

Register the plugin in the main project's TSTL configuration:

```json
{
  "tstl": {
    "luaPlugins": [
      {
        "name": "@lib/warcraft-tstl-plugin"
      }
    ]
  }
}
```

The package is loaded by TSTL through Node.js.

The plugin itself must not be compiled into Warcraft Lua.

## Limitations

The plugin currently assumes API usage has the form:

```ts
Api.SomeGlobal
```

where `Api` comes from:

```ts
import * as Api from "@lib/warcraft3-api/...";
```

Avoid patterns such as:

```ts
const playerFn = PlayerApi.Player;
```

or:

```ts
const { Player } = PlayerApi;
```

unless they have been explicitly verified against the plugin.

The intended usage is direct access:

```ts
PlayerApi.Player(0);
```

The plugin also assumes that exported value names correspond exactly to Warcraft runtime global names.

For example:

```ts
PlayerApi.GetPlayerId(...)
```

is rewritten to:

```lua
GetPlayerId(...)
```

Renamed TypeScript exports therefore require additional plugin support.
