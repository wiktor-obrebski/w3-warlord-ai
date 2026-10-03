# Privileged code

Code here does things normal bot gameplay must never do: take over players,
move units between owners, replace map globals, reveal the map. It exists
only for **installation**, **debug mode** and **automated tests**.

## Rules

* Only the startup entry point (`src/main.ts`) and automated tests may import
  from this directory. Gameplay code (perception, reasoning, strategies,
  actions) must not.
* Warcraft APIs needed only here are declared in
  `@lib/warcraft3-api/privileged`, so their use outside this directory is easy
  to spot. Gameplay code must not import that module either.

## Map globals

The runtime wrapper (`runtime/runtime-template.lua`) runs one sandboxed bundle
instance per bot, so the bundle's globals are private to that bot. The wrapper
exposes the real map script globals as `map_globals`. 
Use it only to replace natives that Blizzard.j code must see differently
