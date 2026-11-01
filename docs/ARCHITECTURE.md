# WC3 Warlord AI Architecture

The bot's mind follows **Chain of Command**, a BDI architecture for real-time strategy. These documents describe it:

- [Overview](wip/architecture-overview.md): the short version, for everyday work.
- [Architecture](wip/architecture.md): every concept and rule with its reasons, and where a new behavior goes.
- [Testability](wip/architecture-testability.md): what makes the bot easy to test.
- [Risks and open questions](wip/architecture-risks.md).
- [Glossary](wip/glossary.md): every term of the architecture.
- [Research](research/rts-behavior-architecture.md): the research behind the architecture, with walkthroughs, the [scenario analysis](research/rts-scenario-analysis.md), and the [sources](research/rts-research-sources.md).

This document covers what they don't: how far the code has been migrated to the architecture, how the bot runs inside Warcraft III, and how the source is laid out.

## Migration status

The code is being migrated to Chain of Command in phases. The decision layer, Desires, Deliberation, the Intention runtime, and Allocation, comes from [`@lib/chain-of-command`](../lib/chain-of-command/README.md).

| Phase | Content                                                                                        | Status      |
| ----- | ---------------------------------------------------------------------------------------------- | ----------- |
| 0     | The architecture documents are adopted                                                         | done        |
| 1     | Perception, unit ids, the order executor, seeded randomness, the mind, a first decision record | done        |
| 2     | One world model in Beliefs                                                                     | done        |
| 3     | Desires, Deliberation, Intention kinds                                                         | done        |
| 4a    | Unit Behaviors and Directives                                                                  | done        |
| 4b    | Allocation of units                                                                            | done        |
| 4c    | Allocation of money, RunEconomy                                                                | done        |
| 5     | Clean-up                                                                                       | in progress |

The bot's behaviors today:

- **Unit Behaviors** order every unit, carrying out the Directive its owner gave it. The workers' reflex comes first: attacked workers flee from the nearby enemy force, whatever their Directive, and take an unfinished one up again once safe. Guard Towers without a Directive in progress focus their fire by target priority, each from the moment its upgrade ends.

The rest goes through Desires and Intentions:

- **The strategy concern** proposes `ExecuteStrategy{HumanTowerRush}` when the bot plays Human and knows where the enemy started. It knows that only on maps with a single start location besides its own, since it does not read which start location the enemy got; otherwise it vetoes its proposal, giving that reason.
- **ExecuteStrategy** is the committed strategy: it follows the Human tower rush playbook (`src/playbooks/`). The playbook has a single phase, Rush, which proposes EstablishTowerPosition and `RunEconomy{TowerRush}`, handing RunEconomy the playbook's build order in its Desire.
- **EstablishTowerPosition** is the tower rush itself. Three of the starting Peasants go forward as Militia, build Scout Towers next to the enemy main, upgrade them to Guard Towers, and then repair the towers and hide behind them. Its run asks Allocation for three Peasants, then for those forward workers by name, and for the Scout Towers; it reserves the money for the towers while it builds them, and for the upgrades from when the towers are half built.
- **RunEconomy** is the home economy, as the build order in its Desire says: the first worker puts up the opening, the Lumber Mill, and then Peasants are trained and sent to gold or lumber, stage by stage, until the last stage of workers is reached. It reserves the money for the mill and for each Peasant. Proposed at Background rank, it comes last on the agenda, so it gets the Town Hall and every worker the rush leaves, as their default owner. The architecture has a concern propose RunEconomy; here the playbook does, since an economy belongs to its strategy.

They run inside the mind, behind the two boundaries. Every 0.1 s, `src/shell/runtime.ts` takes Perception's observations, steps the mind, hands the orders the step returns to the order executor, and writes the step's decision record. Units and destructables are named by ids; only the shell holds Warcraft handles. An order Warcraft refuses reaches the mind with the next observations, and the part of the mind that gave it can correct its own state. Randomness comes from one generator, seeded once from Warcraft's synchronized generator.

Each step first revises the Beliefs, which have only the sections today's behaviors read: the time; self, with the bot's units, resources, and home, and the attacks on its units it still remembers; and enemy, with the enemy units in sight and, when the start locations tell it, where the enemy started. Enemy units seen earlier are not remembered, and there are no neutral, map, or events sections yet. What a reflex or a plan run remembers for itself, such as when each worker was last attacked, is its own execution state.

Then the workers' reflex claims the workers it protects, and a deliberation cycle runs once a second, and on the next step after an Intention is adopted or ends: the concerns and the Intentions' runs propose Desires, and Deliberation adopts, drops, and orders the Intentions. Every Intention kind has a single plan so far, and the weights are placeholders: ranks alone order the Intentions that compete. Every step, Allocation grants each unit to the first Intention on the agenda whose run needs it, up to the need's count, and reserves each run's money need from what the Intentions before it left of the stock. It has no minimums, switching margins, or projection of income yet, and the workers' default owner is simply the last Intention whose need matches every worker. The mind steps the agenda's Intentions in its order, each at its kind's pace, with its force: the units it was granted, less those the reflex claimed. Their runs give these units Directives, and a Directive or probe for a unit outside the force throws. The mind records every Desire, Intention, agenda, and grant change as a note. Last, the Unit Behaviors order the units: the reflex its workers, every other unit with a Directive in progress as that Directive asks, and the Guard Towers without one at the targets they pick.

Two temporary exceptions remain, for later phases to remove:

- **Probes.** The mind still makes some Warcraft calls directly, through the `WarcraftProbes` the shell gives it: the orders whose acceptance is a test (Lumber Mill and Scout Tower placement, the tree-test harvests, tower targeting's fallback to the next target) and two static reads (`IsTerrainPathable` and `IsUnitInRange`). A probe orders its unit at once, so the mind refuses one for a unit that already has an order queued in the same step, the Unit Behaviors leave a unit a probe ordered alone until the next step, and a run's force leaves out the units the reflex claimed.
- **Knowledge** is a stub. Static facts, such as the start locations, the gold mines, and the trees near home, still come from Perception.

## Runtime environment and TypeScriptToLua

The bot executes as a **Lua map script** inside Warcraft III. It is developed primarily in **TypeScript** and compiled with **TypeScriptToLua (TSTL)**, targeting Lua 5.3.

**TypeScript source → generated Lua bundle → runtime wrapper → Warcraft III Lua map runtime**

TypeScript provides static typing, modules, structured data, reusable abstractions, and familiar development tooling. Generated Lua is a build artifact rather than the primary source representation, and should never be edited manually.

The runtime is Warcraft, not Node.js or a browser. Runtime dependencies must work with TSTL and the Lua facilities exposed by Warcraft. Build tooling runs outside the game.

- **Runtime wrapper:** the maintained Lua template, `runtime/runtime-template.lua`, that embeds the bundle in a map script, sandboxes one bundle instance per bot, and provides globals such as `guard`, an error listener, and the wall clock.
- **Compatibility layer:** scoped, manually maintained declarations of the Warcraft natives the project uses (`@lib/warcraft3-api`), compiled to plain global calls by the project's TSTL plugin. A declaration alone does not prove runtime support.

### Game integration

A small game integration layer should provide:

- maintained type declarations for the Warcraft natives the project uses;
- explicit player and unit access behind Perception and the order executor;
- map timers and event registration;
- Warcraft handle lifecycle management;
- error reporting and source-location mapping;
- project-defined interfaces that can be substituted in tests.

Map timers, triggers, and callbacks are available. Timer and trigger callbacks are wrapped with `WarlordApi.guard` for error reporting: the wrapper shows every error it catches, at startup or in a guarded callback, in-game with a source-mapped location, and passes the same message to the bundle's error listener, which logs it once logging has started.

Do not assume a usable implicit AI-player context. Our map-script probes did not establish useful behavior for player-paramless AI functions such as `GetUnitCount` and `GetAiPlayer`. Prefer explicit player/unit APIs and maintained bot state. Native declarations alone do not establish runtime compatibility.

Disable the default melee AI for players controlled by this bot so that it does not issue competing orders. The wider access available to map scripts does not relax the fair-information boundary.

### Packaging and startup

TSTL produces one bundle with the required runtime helpers. A Bash packaging step embeds it in the runtime wrapper. The resulting script is installed in a Lua-enabled map, where the wrapper replaces `StartMeleeAI` and runs one bundle instance per `Computer (Normal)` slot during melee initialization.

Units of a computer slot keep some built-in Warcraft AI behaviour even without a melee AI script, so on startup the bundle moves the computer player's units, resources, and start location to an empty slot and controls that player instead. Bot installations are registered in the map globals, shared by all bundle instances, and a single `GetPlayerSlotState` override makes melee victory/defeat see every bot player as playing and every abandoned computer player as gone; this must happen before `MeleeInitVictoryDefeat`. Gameplay starts on the next timer tick.

`src/main.ts` installs the bot player, starts logging and debug mode, and then starts the bot's runtime.

Installation and test-only code with access beyond normal gameplay, such as replacing map globals, lives in `src/privileged/`, with its Warcraft APIs declared in `@lib/warcraft3-api/privileged`. Only the startup entry point and automated tests may use either; see [`src/privileged/README.md`](../src/privileged/README.md).

### Logging

Structured logs come from [`@lib/logger`](../lib/logger/README.md), a Pino-like logger whose calls only store records in a bounded buffer. `src/shell/logging.ts` holds the logging configuration and creates two loggers: the bot's root logger, writing to `Warlord/Logs`, and the decision record's logger, writing to `Warlord/DecisionRecord`, so each can be collected on its own. The record's session is the root session with a `-record` suffix. Both add `gameTime` to every record and write to the library's preload transport, given the preload natives. A timer flushes them every half game second, writing batch files synchronously on the game thread. The decision record is, for now, the notes the mind and its parts make during a step, such as every Desire, Intention, and agenda change; after each step the runtime shows them in-game and writes them, with the step's orders, to the record's log. Every error the runtime wrapper catches once logging has started goes to the root log as `Uncaught error`, with the message shown in-game as `err`. On the host, the [`bin/collect-logs`](../bin/collect-logs/README.md) script reads the batch files with `@lib/logger`'s `parseBatchFile` and writes their records as Pino JSON lines. The runtime wrapper provides the wall clock for record times.

### Debug mode and diagnostic artifacts

`src/privileged/debug-mode.ts` reveals the map to the human observer and shows the bot's resources.

Detailed diagnostics should be explicitly enabled rather than permanently active. When debugging is disabled, diagnostic code should not meaningfully consume CPU, allocate unnecessary intermediate data, or build large messages that are immediately discarded. Expensive diagnostic generation should therefore be guarded close to its source.

A normal player should be able to enable debugging without modifying or recompiling the bot. The intended workflow is:

1. enable debug mode;
2. reproduce the problematic behavior;
3. obtain a diagnostic artifact;
4. send that artifact to the developer.

Where Warcraft's runtime permits it, prefer one self-contained structured artifact per game or diagnostic session. Many important failures only appear during real matches, so diagnostics are most useful when they are cheap while disabled and simple enough that another player can capture a useful report without understanding the bot's internals.

## Testing beyond the architecture

So far only `@lib/logger` and `bin/collect-logs` have automated tests. [Testability](wip/architecture-testability.md) describes the tests the architecture is built for; two more concerns lie outside it.

### Generated-Lua and packaging validation

The compiled bundle and wrapped deployment script should be validated separately from TypeScript decision tests. This should cover:

- TSTL compilation and supported language features;
- Lua 5.3 syntax and required bundled helpers;
- wrapper loading and startup behavior;
- preservation of bundle line numbers and source-map registration;
- TypeScript error locations and preservation of caught Error objects;
- error reporting from callbacks invoked after startup.

Standalone Lua checks can exercise the loader, runtime helpers, and reasoning with substituted game APIs. They cannot establish the behavior of Warcraft natives or engine callbacks. Valid TypeScript and passing JavaScript tests do not guarantee correct transpiled behavior or compatibility with Warcraft's Lua environment, so the actual deployment artifact must be checked, with focused in-game probes for engine-dependent behavior.

### Reusing Warcraft across integration tests

A dedicated Warcraft test map should support controlled behavioral scenarios: creating units and buildings, configuring resources and upgrades, positioning armies, starting the real AI, running the simulation for a defined amount of game time, and reporting structured results. Such tests exercise what pure decision tests cannot: pathfinding, attacks, targeting, visibility, collision, construction, cooldowns, orders, and the Lua map runtime with its timer and event callbacks.

The harness should normally run multiple scenarios during one Warcraft session:

**launch Warcraft → load test map → run test → reset → run next test → report results**

The bot should therefore support resetting its logical state and releasing or unregistering its timers, triggers, and other owned Warcraft resources, so callbacks from a previous scenario do not affect the next one. A smaller number of tests may still require a fresh Warcraft process when game-engine state cannot be reliably restored. Game startup is expensive compared with a short behavioral scenario, so reusing the process makes a substantial real-engine regression suite practical.

## Source layout

```text
src/
├─ main.ts        startup: installs the bot player, debug mode, logging, starts the runtime
├─ shell/         the only code touching Warcraft: the bot loop (runtime.ts), Perception, the order executor, the probes, logging, debug output, the game clock
├─ mind/          the mind: the tick's phases, the orders it gives, and its decision record notes
├─ knowledge/     the Knowledge type, a stub so far
├─ contracts/     type-only vocabulary shared across layers: ids, observations, the Beliefs, orders, probes, the decision record, outcomes and proposals, Warlord Intention kind types, Directives, playbooks and build orders, observed world records
├─ beliefs/       the belief models, revising the Beliefs from the observations
├─ desires/       outcome identity and the concerns
├─ deliberation/  the adoption registry: which Intention kind pursues each kind of outcome
├─ intentions/    one module per Intention kind: the *.api.ts entry point, *.kind.ts, its plans' runs, their parts, and *.judgments.ts, its private interpretations of the Beliefs
├─ playbooks/     the strategies as data, with their build orders: the Human tower rush
├─ unit-behaviors/ what every own unit does each step: the workers' reflex, then the Directive its owner gave it
└─ privileged/    installation and debug-mode code beyond normal gameplay
```

Which modules may import which, to be enforced by an architecture linter later:

| Module                   | May import                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `lib/**`                 | nothing from `src/`                                                                                        |
| `contracts/`             | `@lib/**`, `contracts/`; types only                                                                        |
| `knowledge/`             | `@lib/**`, `contracts/`                                                                                    |
| `beliefs/`               | `@lib/**`, `contracts/`, `beliefs/`                                                                        |
| `desires/`, `playbooks/` | `@lib/**`, `contracts/`, its own directory                                                                 |
| `intentions/<module>/`   | `@lib/**`, `contracts/`, its own module                                                                    |
| `unit-behaviors/`        | `@lib/**`, `contracts/`, `unit-behaviors/`                                                                 |
| `deliberation/`          | `@lib/**`, `contracts/`, `playbooks/`, `intentions/**/*.api.ts`                                            |
| `mind/`                  | `@lib/**`, `contracts/`, `knowledge/`, `beliefs/`, `desires/`, `deliberation/`, `unit-behaviors/`, `mind/` |
| `shell/`                 | `@lib/**`, `contracts/`, `knowledge/`, `mind/mind.ts`, `shell/`                                            |
| `main.ts`                | `@lib/**`, `shell/`, `privileged/`                                                                         |
| `privileged/`            | `@lib/warcraft3-api/**`                                                                                    |

- Contracts are imported with `import type`.
- Only `shell/`, `privileged/`, and `main.ts` import `@lib/warcraft3-api`; elsewhere, `@lib/**` excludes it. The race modules (`human`, `neutral`, `nightelf`, `orc`, `undead`) are the exception: their rawcodes are compile-time constants. Lint enforces this.
- From outside an Intention kind module, only its `*.api.ts` file is imported. Intention kinds never import other Intention kind modules or `playbooks/`: what they need from outside, such as the playbooks, reaches them through their Capabilities.
- Only `privileged/` imports `@lib/warcraft3-api/privileged`.
- No import cycles other than type-only imports.
