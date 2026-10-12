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
│  ├─ providers / component tree
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
- **Runtime** — Runs and manages the bot loop for one player, orchestrating the mind each tick; owns all belief state, the active Intentions, and actor control. Debug mode is not part of it.
- **Beliefs runtime** — Owns belief state and its lifecycle: revises the Common Beliefs, registers the components of the managed component tree, revises the Scoped Beliefs of those with a BeliefsModel before they update, and removes them when components leave the tree. Stores the state in the BeliefContainer.
- **Provider** — The `provide<Name>Intention/Plan/Controller()` function through which every component is constructed; returns the component together with its optional BeliefsModel and its children, while the component class stays private. Components create and discard children through child factories injected by their provider.
- **Component tree** — The provided Intentions and the children their providers recorded; the tree the beliefs runtime and the actor control arbiter manage.
- **Actor control arbiter** — Tracks which Plan or Controller controls each Actor and with what request; runs each Plan and Controller update with an actor control provider scoped to it, expires unrenewed claims after the update, and releases claims of sources that left the component tree. Whether a request takes an Actor is decided by the bot's actor control policy, not by the arbiter.
- **Actor control policy** — The bot's rule for granting or refusing a request for an Actor held by another source or by none (`actorControlPolicy` in `src/actor.ts`).
- **Central Timing Scheduler** — Invokes reasoning and control systems at their required frequencies; it does not decide which intentions should progress.
- **Tactical frequency** — Fast update cadence for controllers and immediate combat behavior.
- **Intention-monitoring frequency** — Cadence for checking active plans, progress, and lifecycle conditions.
- **Belief-update frequency** — Cadence for derived reasoning that does not require tactical-rate execution.
- **Strategic frequency** — Slower cadence for broad goal generation and deliberation.
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
revise Common Beliefs → Deliberation → provided Intentions
→ sync the component tree: register new components, remove gone ones, revise Scoped Beliefs
→ update() Intentions → Plans & Controllers, each with its own Beliefs and through the actor control arbiter
→ prune components discarded this tick, releasing their Scoped Beliefs and control
```

A component created during the tick is registered and has its Scoped Beliefs first revised before its first update.

Generic BDI contracts, the beliefs runtime (`createBeliefsRuntime`, `BeliefContainer`), providers (`Provided`, `childFactory`), and the actor control arbiter (`createActorControlArbiter`, `ActorControlProvider`, `ActorControlPolicy`) live in the domain-independent [`@lib/bdi`](../lib/bdi/README.md). The policy deciding which requests are granted is domain code in `src/actor.ts`. Timer and trigger callbacks are wrapped with `WarlordApi.guard` for error reporting.

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
├─ Deliberation
│  ├─ Desire
│  ├─ Candidate Goal
│  ├─ Goal evaluation
│  ├─ Goal
│  │  ├─ achievement
│  │  └─ maintenance
│  ├─ Intention
│  │  └─ lifecycle
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
- **Common Beliefs** — Beliefs shared by the whole bot and read by every component.
- **Scoped Beliefs** — Private belief state of one Intention, Plan, or Controller instance, maintained by a BeliefsModel shared by any number of instances.
- **Current belief** — Belief directly supported by present observation.
- **Retained belief** — Previously observed information preserved after visibility is lost.
- **Inferred belief** — Conclusion derived from available evidence rather than direct observation.
- **Provenance** — Information about where a belief came from and when it was last confirmed.
- **Uncertainty** — Explicit representation that inferred or stale information may be wrong.
- **Assessment** — Pure interpretation of Beliefs into decision-oriented information, such as which enemies a tower should fire at; keeps no state and does not access Warcraft.
- **Desire** — High-level state or principle the bot wants to achieve or maintain, such as applying pressure; carries no behavior.
- **Deliberation** — Decides from Beliefs, Desires, and active Intentions which Intentions exist; owns the Intention lifecycle.
- **Candidate Goal** — Desirable possible objective not yet accepted as a commitment.
- **Goal evaluation** — Comparison of candidate goals using value, urgency, risk, opportunity cost, resources, and commitments.
- **Achievement goal** — Objective that aims to make some desired state true.
- **Maintenance goal** — Objective that aims to keep an important condition true.
- **Intention** — Concrete commitment the bot is pursuing; active while Deliberation retains it, with no success or failure status of its own. May own Plans and Reactive Controllers.
- **Intention lifecycle** — Owned by Deliberation, which creates, retains, and drops Intentions; richer states such as suspended or blocked may be added later.
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
Beliefs + Desires → Deliberation → Intentions → Plans & Controllers
                                                  ├─ read Beliefs through Assessments
                                                  └─ order Actors under Actor Control → Warcraft orders
```

Beliefs come in two categories. Common Beliefs (`src/beliefs/common.beliefs.ts`) hold broadly useful game knowledge and are read by every component. Scoped Beliefs are private to one component instance: a component's provider may return a shared, stateless BeliefsModel (`*.beliefs.ts`), and the runtime keeps that component's own Beliefs in the BeliefContainer, indexed by the component instance. Each component receives `{ common, scoped }` in `update()`, with `scoped` null when it has no model; it never sees its model. Intentions, Plans, and Controllers keep only execution state. Perception is not a separate layer: each model's `observe()` reads Warcraft state. Retained beliefs are limited to short attack memory (Common Beliefs) and when workers were last attacked (the worker safety controller's Scoped Beliefs, the current example of the mechanism).

Every component is constructed through its `provide...()` function (`src/execution.ts` holds the Warlord component types). Intentions create their Plans and Controllers through child factories injected by their providers, and discard them when done, e.g. the tower rush discards its plan once the tower position is established.

Assessments are pure functions in `*.assessments.ts`: no state, no Warcraft API access, read-only Beliefs. Broadly useful ones live in `src/beliefs/common.assessments.ts`, feature-specific ones next to their feature. `*.beliefs.ts` keeps only Belief types and revision; Plans and Controllers call assessments instead of interpreting Beliefs themselves.

The Desires are held for the whole game, and Deliberation maps them to Intentions with a fixed policy:

```text
ProtectEconomicAssets        → MaintainWorkerSafety → WorkerSafetyController
ApplyPressure                → TowerRush            → EstablishTowerPositionPlan, TowerRushEconomyController, TowerMaintenanceController
UseMilitaryAssetsEffectively → OperateTowers        → TowerTargetSelectionController (once the tower position is established)
```

Before ordering an Actor, every Plan and Controller requests Actor Control for it and orders it only when granted. Normal sources request each update the Actors they need; worker safety requests attacked workers preemptively until they are safe again, then lets control expire so their previous controller can request them back. Control decides only who may order an Actor now, not which Intention the Actor belongs to.

```text
src/
├─ main.ts        startup: installs the bot player, debug mode, starts the runtime
├─ runtime.ts     the bot loop
├─ actor.ts       Actor type, actor control requests and policy
├─ execution.ts   Warlord component, Beliefs, and provider types
├─ beliefs/       common belief model, observing Warcraft state for decisions, and common assessments
├─ desires/       ApplyPressure, ProtectEconomicAssets, UseMilitaryAssetsEffectively
├─ deliberation/  creates, retains, and drops Intentions
├─ intentions/    *.intention.ts, *.plan.ts, *.ctrl.ts, scoped *.beliefs.ts, and *.assessments.ts
└─ privileged/    installation and debug-mode code beyond normal gameplay
```

Not yet implemented: canonical unit ids, inferred beliefs, provenance and uncertainty, goal evaluation, Resource Arbitration, Unit Assignment, Command Arbitration, Intention Scheduling, execution monitoring, and strategic navigation. Plans and Controllers still issue Warcraft orders directly rather than through Actions.
