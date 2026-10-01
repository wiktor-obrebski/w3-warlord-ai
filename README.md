# WC3 Warlord AI

**WC3 Warlord AI** is a Warcraft III melee AI designed to behave more like a competent player than a traditional scripted bot.

It is written in **TypeScript**, compiled with **TypeScriptToLua (TSTL)** to a single Lua bundle.

## Build manually

There is 2 steps to use W3 Warlord AI in games.

1. Build the lua bundle:
```sh
npm run bundle
```
Output: `_build/warlord-ai.lua`

2. Build a new W3 map which the script installed
```sh
npm run build-map $SOURCE_MAP $DESTINATION_PATH [_build/warlord-ai.lua]
```

Last parameter is optional.
On the new map all slots set to `Computer (Normal)` will be controlled by Warlord AI. 

## Docker Sandbox Kit

This project includes a custom [Docker Sandbox](https://docs.docker.com/ai/sandboxes/) kit used to provide a reproducible environment for running coding agents such as OpenCode.

The kit defines the sandbox image, required tools, environment configuration, and project-specific defaults. This keeps the agent environment isolated from the host system and makes it easier to reproduce the same setup across machines.

See [`sandbox/README.md`](sandbox/README.md) for setup, configuration, and usage instructions.
