# WC3 Warlord AI — Architecture Sitemap

**WC3 Warlord AI** is a Warcraft III melee AI designed to behave more like a competent player than a traditional scripted bot. This document is a short reference to the project's main concepts and architecture.

The architecture has two sides:

- **[Technical architecture](#technical-architecture)** — how the bot runs inside Warcraft: language and packaging, the boundaries to the game, the runtime loop, timing, diagnostics, and testing.
- **[Mind architecture](#mind-architecture)** — how the bot thinks: what it knows, what it wants, what it commits to, and how it acts on those commitments.

---

## Technical architecture

### Concept map

```text
Technical architecture
├─ Runtime / integration
│  ├─ TypeScript
│  ├─ AI-compatible Lua
│  ├─ Runtime wrapper
│  ├─ Compatibility layer
│  ├─ Observe boundary
│  └─ Execute boundary
│
├─ Runtime
│  ├─ bot loop
│  ├─ beliefs runtime
│  ├─ assembly / component tree
│  ├─ Option Generation runtime
│  ├─ actor control arbiter
│  └─ actor control policy
│
├─ Timing
│  ├─ Central Timing Scheduler
│  ├─ tactical frequency
│  ├─ intention-monitoring frequency
│  ├─ belief-update frequency
│  ├─ strategic frequency
│  └─ urgent event triggers
│
├─ Diagnostics
│  ├─ decision trace
│  ├─ debug mode
│  └─ diagnostic artifact
│
└─ Testing
   ├─ Unit tests
   ├─ Integration tests
   ├─ End-to-end tests
   └─ logical reset
```

### Concepts

- **TypeScript** — Primary implementation language for domain and architecture code.
- **AI-compatible Lua** — Generated Lua 5.3 bundle, a deployment artifact executed as part of a Warcraft III Lua map script.
- **Runtime wrapper** — Maintained Lua template that embeds the bundle in a map script, sandboxes one bundle instance per bot, and provides globals such as `guard`.
- **Compatibility layer** — Scoped, manually maintained declarations of the Warcraft natives the project uses (`@lib/warcraft3-api`), compiled to plain global calls by the project's TSTL plugin. A declaration alone does not prove runtime support.
- **Observe boundary** — Warcraft-facing boundary through which legitimate game information enters the reasoning system.
- **Execute boundary** — Warcraft-facing boundary through which selected actions affect the game.
- **Runtime** — Runs and manages the bot loop for one player, orchestrating the mind each tick; owns all belief state, the Desires, the active Intentions, and actor control. Debug mode is not part of it.
- **Beliefs runtime** — Owns belief state and its lifecycle: revises the Common Beliefs, registers the components of the managed component tree, revises the Scoped Beliefs of those with a BeliefsModel before they update, and removes them when components leave the tree. Stores the state in the BeliefContainer.
- **Assemble function** — The `assemble<Name>Intention/Plan/Controller()` function through which every component is constructed; returns the component together with its optional BeliefsModel and its children (an `AssembledComponent`), while the component class stays private. Components create and discard children through child factories injected by their assemble function.
- **Capabilities** — What a component needs from outside its module beyond its Beliefs, such as actor control, declared by the component as a `<Name>Capabilities` interface and received once through its assemble function. Its owner supplies an object implementing it, a capabilities provider: Deliberation for Intentions, an Intention for its private children. `update()` receives only Beliefs.
- **Component tree** — The assembled Intentions and the children their assemble functions recorded; the tree the beliefs runtime, the actor control arbiter, and Option Generation manage.
- **Option Generation runtime** — Owns the desire supports and Desires; provides the one desire expression every Intention receives as a capability, which acts for the Intention whose update it is running; generates the current Desires each tick, and withdraws the supports of Intentions that left the component tree.
- **Actor control arbiter** — Tracks which Plan or Controller controls each Actor and with what request; provides the one actor control every Plan and Controller receives as a capability, which acts for the source whose update the arbiter is running; expires unrenewed claims after the update, and releases claims of sources that left the component tree. Whether a request takes an Actor is decided by the bot's actor control policy, not by the arbiter.
- **Actor control policy** — The bot's rule for granting or refusing a request for an Actor held by another source or by none (`actorControlPolicy` in `src/capabilities/actor-control/`).
- **Central Timing Scheduler** — Invokes reasoning and control systems at their required frequencies; it does not decide which intentions should progress.
- **Tactical frequency** — Fast update cadence for controllers and immediate combat behavior.
- **Intention-monitoring frequency** — Cadence for checking active plans, progress, and lifecycle conditions.
- **Belief-update frequency** — Cadence for derived reasoning that does not require tactical-rate execution.
- **Strategic frequency** — Slower cadence for broad strategy assessment and deliberation.
- **Urgent event trigger** — Event that requests relevant reasoning before its normal scheduled execution.
- **Decision trace** — Debug reconstruction of important reasoning from observation through beliefs and intentions to actions.
- **Debug mode** — Explicitly enabled diagnostic behavior that should impose negligible cost when disabled.
- **Diagnostic artifact** — User-shareable output containing enough structured information to analyze a problematic game.
- **Unit test** — Isolated test of one module, rule, transition, or small component.
- **Integration test** — Warcraft-free test feeding mocked Perception output through the normal reasoning architecture.
- **End-to-end test** — Controlled scenario executed against the real Warcraft III engine.
- **Logical reset** — Ability to return bot state to a clean condition so multiple tests can run in one Warcraft session.

### Current implementation

`src/main.ts` installs the bot player, starts debug mode, and starts the bot's runtime (`startRuntime` in `src/runtime.ts`). The runtime is a plain function whose state lives in its closure. Each 100 ms tick runs:

```text
revise Common Beliefs → Option Generation → current Desires → Deliberation → assembled Intentions
→ sync the component tree: register new components, remove gone ones, revise Scoped Beliefs
→ update() Intentions, each through Option Generation → Plans & Controllers, each with its own Beliefs and through the actor control arbiter
→ prune components discarded this tick, releasing their Scoped Beliefs, control, and desire supports
```

A component created during the tick is registered and has its Scoped Beliefs first revised before its first update. Desires expressed during the tick appear on the next one, so expression cannot adopt Intentions recursively within a tick.

Generic BDI contracts, the beliefs runtime (`createBeliefsRuntime`, `BeliefContainer`), component assembly (`AssembledComponent`, `childFactory`), the Option Generation contract (`OptionGeneration`, `DesireExpressionProvider`), and the actor control arbiter (`createActorControlArbiter`, `ActorControlProvider`, `ActorControlPolicy`) live in the domain-independent [`@lib/bdi`](../lib/bdi/README.md). The bot's Option Generation is implemented in `src/desires/option-generation/`, including how stale supports decay and expire, and created with the bot's permanent Desires by `createDesires` in `src/desires/`, over the outcomes in `src/contracts/desires.ts`. A support stays fresh for its `refreshSeconds` plus one tick, since its Intention can refresh it only on a tick, then decays linearly over two more intervals and expires. The bot's actor control, the arbiter together with the policy deciding which requests are granted, is created by `createActorControl` in `src/capabilities/actor-control/`, over the request type in `src/contracts/actor-control.ts`. Timer and trigger callbacks are wrapped with `WarlordApi.guard` for error reporting.

Not yet implemented: the Central Timing Scheduler (intentions throttle their own update cadence), decision traces, diagnostic artifacts, and automated tests.

---

## Mind architecture

### Concept map

```text
Mind architecture
├─ Information model
│  ├─ Fair-information boundary
│  ├─ Perception
│  ├─ Observation
│  ├─ World Model
│  ├─ Belief
│  │  ├─ current
│  │  ├─ retained
│  │  └─ inferred
│  ├─ Common / Scoped Beliefs
│  ├─ provenance
│  └─ uncertainty
│
├─ Assessment
│
├─ Desires
│  ├─ Desire
│  │  └─ permanent
│  ├─ Desire Support
│  │  ├─ expression
│  │  ├─ withdrawal / replacement
│  │  └─ staleness
│  └─ Option Generation
│
├─ Deliberation
│  ├─ Goal
│  │  ├─ achievement
│  │  └─ maintenance
│  ├─ Intention
│  │  ├─ lifecycle
│  │  └─ commitment assessment
│  ├─ Intention Scheduling
│  ├─ Resource Arbitration
│  └─ Plan
│     └─ continual adaptation
│
├─ Execution
│  ├─ Execution monitoring
│  ├─ Reactive Controller
│  │  └─ Behavior Tree where useful
│  ├─ Actor
│  ├─ Actor Control
│  │  ├─ normal / preemptive claim
│  │  └─ lease
│  ├─ Unit Assignment
│  │  ├─ strategic ownership
│  │  ├─ execution role
│  │  └─ command authority
│  ├─ Command Arbitration
│  └─ Action
│
└─ Navigation
   ├─ Static map graph
   ├─ Strategic route
   ├─ Dynamic route cost
   ├─ Route replanning
   └─ Warcraft local pathfinding
```

### Concepts

- **Fair-information boundary** — Prevents reasoning code from using hidden enemy state available only through scripting APIs.
- **Perception** — Reads raw Warcraft state and produces legitimate current observations without memory or inference.
- **Observation** — Project-defined representation of information legitimately available at the current moment.
- **World Model** — Central representation of what the bot currently believes about the match.
- **Belief** — Current, remembered, or inferred claim about the game state.
- **Common Beliefs** — Beliefs shared by the whole bot and read by every component, each through its own declaration of the part it needs.
- **Scoped Beliefs** — Private belief state of one Intention, Plan, or Controller instance, maintained by a BeliefsModel shared by any number of instances.
- **Current belief** — Belief directly supported by present observation.
- **Retained belief** — Previously observed information preserved after visibility is lost.
- **Inferred belief** — Conclusion derived from available evidence rather than direct observation.
- **Provenance** — Information about where a belief came from and when it was last confirmed.
- **Uncertainty** — Explicit representation that inferred or stale information may be wrong.
- **Assessment** — Pure interpretation of Beliefs into decision-oriented information, such as which enemies a tower should fire at; keeps no state and does not access Warcraft.
- **Desire** — Outcome the bot currently considers desirable but has not necessarily committed to, at any level, from maintaining an effective strategy to acquiring an item for a hero; has a canonical identity, so equivalent outcomes are one Desire; carries no behavior.
- **Permanent Desire** — Desire the bot itself supports for the whole game, independently of any Intention, such as maintaining an effective strategy.
- **Desire Support** — One source's expression of interest in a Desire, with its own importance and freshness; one Desire may have many, from different Intentions.
- **Desire expression** — Capability through which an Intention expresses, refreshes, withdraws, or replaces only the supports it owns; an Intention leaving the component tree loses all of them.
- **Staleness** — A support its Intention stops refreshing decays over game time, relative to its own refresh interval, and then expires; distinct from withdrawal, which takes effect at once.
- **Option Generation** — Determines the current Desires from expressed supports and permanent Desires, keeping each Desire's object across ticks and retiring Desires left without support; decides what is worth pursuing, not what the bot commits to.
- **Deliberation** — Decides from Beliefs, Desires, and active Intentions which Intentions exist; owns the Intention lifecycle and weighs competing Desires and commitments.
- **Achievement goal** — Objective that aims to make some desired state true.
- **Maintenance goal** — Objective that aims to keep an important condition true.
- **Intention** — Concrete commitment the bot is pursuing; active while Deliberation retains it, with no success or failure status of its own. May own Plans and Reactive Controllers.
- **Intention lifecycle** — Owned by Deliberation, which creates, retains, and drops Intentions; richer states such as suspended or blocked may be added later.
- **Commitment assessment** — An Intention's side-effect-free judgment (`assessCommitment`) of whether maintaining its own commitment remains worthwhile, even once the Desire it was adopted for is gone; Deliberation weighs it but decides.
- **Intention Scheduling** — Coordinates concurrent intentions, deciding which progress, wait, suspend, or receive contested resources.
- **Resource Arbitration** — Resolves competing requests for units, heroes, resources, production capacity, locations, and similar shared resources.
- **Plan** — Finite procedure pursuing an intention, with an explicit running, succeeded, or failed status; replaceable without necessarily abandoning the intention.
- **Continual planning** — Refines or replaces plans during execution as new observations and beliefs arrive.
- **Execution monitoring** — Checks whether active plans remain valid, succeed, fail, or require adaptation.
- **Reactive Controller** — Continuous reactive behavior owned by an Intention, without procedural completion, handling fast execution below deliberation; commonly uses Behavior Tree-style logic where appropriate.
- **Unit Assignment** — Authoritative mapping of a unit to its intention, execution role, and current controller.
- **Strategic ownership** — Which intention currently owns a unit or other resource.
- **Execution role** — Current function of an assigned unit, such as fighting, joining, scouting, or withdrawing.
- **Actor** — Any entity the bot can control through the Warcraft III API, such as units and buildings; at the API level both are Warcraft units.
- **Actor Control** — Temporary exclusive right of one Plan or Controller to order an Actor; every Actor has at most one controlling source. The current form of command authority.
- **Normal / preemptive claim** — A normal request takes only an uncontrolled Actor; a preemptive one also takes it from a normal holder, as worker safety does with an attacked worker. A preemptive claim is never taken over.
- **Lease** — A source keeps control only while it requests the Actor again in each of its updates; unrenewed claims expire when the update ends.
- **Command authority** — Which controller is currently allowed to normally command a unit.
- **Command Arbitration** — Selects the concrete action when several tactical systems propose incompatible commands for the same unit.
- **Action** — Concrete request to change Warcraft state, such as move, attack, cast, build, train, research, or buy.
- **Static map graph** — Preprocessed representation of important regions, corridors, connectivity, chokes, and strategic locations.
- **Strategic route** — Selected sequence of meaningful regions or waypoints used to reach a destination.
- **Dynamic route cost** — Runtime modification of route desirability using beliefs such as danger, enemy presence, or blockage.
- **Route replanning** — Selection of another strategic route when current conditions make the existing one unsuitable.
- **Warcraft local pathfinding** — Engine-provided detailed movement between strategic waypoints.

### Current implementation

The implemented subset is a first BDI iteration:

```text
permanent Desires + desire supports → Option Generation → Desires
Beliefs + Desires → Deliberation → Intentions → Plans & Controllers
                                    │             ├─ read Beliefs through Assessments
                                    │             └─ order Actors under Actor Control → Warcraft orders
                                    └─ express desire supports (seen by Option Generation on the next tick)
```

Beliefs come in two categories. Common Beliefs (`src/beliefs/common.beliefs.ts`) hold broadly useful game knowledge and are read by every component. Components do not know the global `CommonBeliefs` type: each Intention module declares the part it needs as its own interface (`*.common-beliefs.ts`), shared by its private Plans and Controllers and exported through its API file. Its assemble function is generic over the bot's Common Beliefs type and constrained by that interface, so Deliberation, assembling it with `CommonBeliefs`, fails to compile when the global Common Beliefs stop providing what the module needs; the same object is passed at runtime, without projection or copying. Scoped Beliefs are private to one component instance: a component's assemble function may return a shared, stateless BeliefsModel (`*.beliefs.ts`), and the runtime keeps that component's own Beliefs in the BeliefContainer, indexed by the component instance. Each component receives `{ commonBeliefs, scopedBeliefs }` in `update()`, with `scopedBeliefs` null when it has no model; it never sees its model. Intentions, Plans, and Controllers keep only execution state. Perception is not a separate layer: each model's `observe()` reads Warcraft state. Retained beliefs are limited to short attack memory (Common Beliefs) and when workers were last attacked (the worker safety controller's Scoped Beliefs, the current example of the mechanism). The Common Beliefs also hold the bot's own race and `currentStrategy`, the strategy Deliberation committed to on the previous tick; the runtime passes it to the Common Beliefs model, which observes it like the world.

Every component is constructed through its `assemble...()` function (`src/contracts/component.ts` holds the Warlord component types). Intentions create their Plans and Controllers through child factories injected by their assemble functions, and discard them when done, e.g. the tower rush discards its plan once the tower position is established. The runtime hands the arbiter's actor control and Option Generation's desire expression to Deliberation, whose capabilities providers pass them to the Intentions declaring them. Each Intention passes actor control on to its children; desire expression is meant for Intentions only.

Assessments are pure functions in `*.assessments.ts`: no state, no Warcraft API access, read-only Beliefs. They are private to the component module interpreting the Beliefs and live next to it; there are no shared assessments, since components may legitimately read the same facts differently, and some duplication between modules is accepted. `*.beliefs.ts` keeps only Belief types and revision; Plans and Controllers call assessments instead of interpreting Beliefs themselves.

Deliberation adopts one Intention for each Desire with a fixed policy, and on every tick asks each retained Intention to assess its commitment, dropping it when the assessment fails; every current Intention remains committed while its Desire exists:

```text
ProtectEconomicAssets (permanent)        → MaintainWorkerSafety → WorkerSafetyController
MaintainEffectiveStrategy (permanent)    → AdaptStrategy        → expresses ExecuteTowerRushStrategy when playing Human
ExecuteTowerRushStrategy                 → TowerRush            → EstablishTowerPositionPlan, TowerRushEconomyController, TowerMaintenanceController
UseMilitaryAssetsEffectively (permanent) → OperateTowers        → TowerTargetSelectionController (once the tower position is established)
```

AdaptStrategy reassesses every 10 game seconds which strategy it prefers, a private assessment distinct from the adopted `currentStrategy` in the Common Beliefs, and keeps supporting the Desire to execute it; it replaces its support when its preference changes and withdraws it when it prefers none. It never adopts a strategy itself: the tower rush is the strategy commitment Deliberation makes for that Desire, a tick after it is first expressed. The bot keeps one strategy commitment alongside its other concurrent Desires. Switching costs and commitment stability will matter once there is more than one strategy.

Before ordering an Actor, every Plan and Controller requests Actor Control for it and orders it only when granted. Normal sources request each update the Actors they need; worker safety requests attacked workers preemptively until they are safe again, then lets control expire so their previous controller can request them back. Control decides only who may order an Actor now, not which Intention the Actor belongs to.

```text
src/
├─ main.ts        startup: installs the bot player, debug mode, starts the runtime
├─ runtime.ts     the bot loop
├─ contracts/     type-only domain vocabulary shared across layers: Warlord component types, Actor and actor control requests, desire outcomes, strategies, observed world records
├─ beliefs/       common belief model, observing Warcraft state for decisions
├─ desires/       the bot's permanent Desires and outcome identity; option-generation/ implements its Option Generation
├─ deliberation/  creates, retains, and drops Intentions
├─ components/
│  ├─ intentions/   one module per Intention: the *.api.ts entry point, *.intention.ts, its private *.plan.ts and *.ctrl.ts, *.common-beliefs.ts, scoped *.beliefs.ts, and *.assessments.ts
│  ├─ plans/        Plans assembled by several Intentions
│  └─ controllers/  Controllers assembled by several Intentions
├─ capabilities/  implementations of what components declare in their Capabilities, one module per capability: actor control
└─ privileged/    installation and debug-mode code beyond normal gameplay
```

Which modules may import which, to be enforced by an architecture linter later:

| Module                                                           | May import                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `lib/**`                                                         | nothing from `src/`                                                                                      |
| `contracts/`                                                     | `@lib/**`, `contracts/`; types only                                                                      |
| `beliefs/`                                                       | `@lib/**`, `contracts/`, `beliefs/`                                                                      |
| `desires/`                                                       | `@lib/bdi`, `contracts/`                                                                                 |
| `components/intentions/<module>/`                                | `@lib/**`, `contracts/`, its own module                                                                  |
| `components/plans/<module>/`, `components/controllers/<module>/` | `@lib/**`, `contracts/`, its own module                                                                  |
| `capabilities/<module>/`                                         | `@lib/**`, `contracts/`, its own module                                                                  |
| `deliberation/`                                                  | `@lib/**`, `contracts/`, `beliefs/`, `desires/`, `components/**/*.api.ts`                                |
| `runtime.ts`                                                     | `@lib/**`, `contracts/`, `beliefs/`, `desires/`, `deliberation/`, `capabilities/**/*.api.ts`, `debug.ts` |
| `main.ts`                                                        | `@lib/**`, `runtime.ts`, `privileged/`, `debug.ts`                                                       |
| `privileged/`                                                    | `@lib/warcraft3-api/**`                                                                                  |
| `debug.ts`                                                       | `@lib/warcraft3-api/**`                                                                                  |

- Contracts are imported with `import type`.
- From outside a component or capability module, only its `*.api.ts` file is imported. Components never import other component modules or `capabilities/`: a reusable Plan or Controller, like any capability, reaches an Intention through its Capabilities.
- Only `privileged/` imports `@lib/warcraft3-api/privileged`.
- No import cycles other than type-only imports.
- Temporary exceptions: component modules may still import `debug.ts`, and Intention modules `components/intentions/update-interval.ts`.

Not yet implemented: canonical unit ids, inferred beliefs, provenance and uncertainty, aggregate Desire importance, retiring Desires that Beliefs show irrelevant or satisfied, Desires generated directly from Beliefs, a completion outcome for Intentions distinct from abandonment, Resource Arbitration, Unit Assignment, Command Arbitration, Intention Scheduling, execution monitoring, and strategic navigation. Plans and Controllers still issue Warcraft orders directly rather than through Actions.
