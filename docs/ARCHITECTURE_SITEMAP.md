# WC3 Warlord AI — Architecture Sitemap

**WC3 Warlord AI** is a Warcraft III melee AI designed to behave more like a competent player than a traditional scripted bot. This document is a short reference to the project's main concepts and architecture.

## Concept map

```text
WC3 Warlord AI
├─ Runtime / integration
│  ├─ TypeScript
│  ├─ AI-compatible Lua
│  ├─ Compatibility layer
│  ├─ Observe boundary
│  └─ Execute boundary
│
├─ Information model
│  ├─ Fair-information boundary
│  ├─ Perception
│  ├─ Observation
│  ├─ World Model
│  ├─ Belief
│  │  ├─ current
│  │  ├─ retained
│  │  └─ inferred
│  ├─ provenance
│  └─ uncertainty
│
├─ Deliberation
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
│  ├─ Unit Assignment
│  │  ├─ strategic ownership
│  │  ├─ execution role
│  │  └─ command authority
│  ├─ Command Arbitration
│  └─ Action
│
├─ Navigation
│  ├─ Static map graph
│  ├─ Strategic route
│  ├─ Dynamic route cost
│  ├─ Route replanning
│  └─ Warcraft local pathfinding
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

## Concepts

* **TypeScript** — Primary implementation language for domain and architecture code.
* **AI-compatible Lua** — Generated deployment artifact executed by Warcraft III's AI runtime.
* **Compatibility layer** — Small audited bridge exposing only to TypeScript only APIs known to work safely in AI scripts.
* **Observe boundary** — Warcraft-facing boundary through which legitimate game information enters the reasoning system.
* **Execute boundary** — Warcraft-facing boundary through which selected actions affect the game.
* **Fair-information boundary** — Prevents reasoning code from using hidden enemy state available only through scripting APIs.
* **Perception** — Reads raw Warcraft state and produces legitimate current observations without memory or inference.
* **Observation** — Project-defined representation of information legitimately available at the current moment.
* **World Model** — Central representation of what the bot currently believes about the match.
* **Belief** — Current, remembered, or inferred claim about the game state.
* **Current belief** — Belief directly supported by present observation.
* **Retained belief** — Previously observed information preserved after visibility is lost.
* **Inferred belief** — Conclusion derived from available evidence rather than direct observation.
* **Provenance** — Information about where a belief came from and when it was last confirmed.
* **Uncertainty** — Explicit representation that inferred or stale information may be wrong.
* **Candidate Goal** — Desirable possible objective not yet accepted as a commitment.
* **Goal evaluation** — Comparison of candidate goals using value, urgency, risk, opportunity cost, resources, and commitments.
* **Achievement goal** — Objective that aims to make some desired state true.
* **Maintenance goal** — Objective that aims to keep an important condition true.
* **Intention** — Goal the bot has committed to pursuing.
* **Intention lifecycle** — Explicit transition between proposed, active, suspended, blocked, completed, failed, and cancelled states.
* **Intention Scheduling** — Coordinates concurrent intentions, deciding which progress, wait, suspend, or receive contested resources.
* **Resource Arbitration** — Resolves competing requests for units, heroes, resources, production capacity, locations, and similar shared resources.
* **Plan** — Current method used to pursue an intention and replaceable without necessarily abandoning the intention.
* **Continual planning** — Refines or replaces plans during execution as new observations and beliefs arrive.
* **Execution monitoring** — Checks whether active plans remain valid, succeed, fail, or require adaptation.
* **Reactive Controller** — Fast execution logic handling tactical behavior below deliberation, commonly using Behavior Tree-style logic where appropriate.
* **Unit Assignment** — Authoritative mapping of a unit to its intention, execution role, and current controller.
* **Strategic ownership** — Which intention currently owns a unit or other resource.
* **Execution role** — Current function of an assigned unit, such as fighting, joining, scouting, or withdrawing.
* **Command authority** — Which controller is currently allowed to normally command a unit.
* **Command Arbitration** — Selects the concrete action when several tactical systems propose incompatible commands for the same unit.
* **Action** — Concrete request to change Warcraft state, such as move, attack, cast, build, train, research, or buy.
* **Static map graph** — Preprocessed representation of important regions, corridors, connectivity, chokes, and strategic locations.
* **Strategic route** — Selected sequence of meaningful regions or waypoints used to reach a destination.
* **Dynamic route cost** — Runtime modification of route desirability using beliefs such as danger, enemy presence, or blockage.
* **Route replanning** — Selection of another strategic route when current conditions make the existing one unsuitable.
* **Warcraft local pathfinding** — Engine-provided detailed movement between strategic waypoints.
* **Central Timing Scheduler** — Invokes reasoning and control systems at their required frequencies; it does not decide which intentions should progress.
* **Tactical frequency** — Fast update cadence for controllers and immediate combat behavior.
* **Intention-monitoring frequency** — Cadence for checking active plans, progress, and lifecycle conditions.
* **Belief-update frequency** — Cadence for derived reasoning that does not require tactical-rate execution.
* **Strategic frequency** — Slower cadence for broad goal generation and deliberation.
* **Urgent event trigger** — Event that requests relevant reasoning before its normal scheduled execution.
* **Decision trace** — Debug reconstruction of important reasoning from observation through beliefs and intentions to actions.
* **Debug mode** — Explicitly enabled diagnostic behavior that should impose negligible cost when disabled.
* **Diagnostic artifact** — User-shareable output containing enough structured information to analyze a problematic game.
* **Unit test** — Isolated test of one module, rule, transition, or small component.
* **Integration test** — Warcraft-free test feeding mocked Perception output through the normal reasoning architecture.
* **End-to-end test** — Controlled scenario executed against the real Warcraft III engine.
* **Logical reset** — Ability to return bot state to a clean condition so multiple tests can run in one Warcraft session.
