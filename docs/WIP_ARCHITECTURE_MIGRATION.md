# Architecture Migration Plan

The code follows the [architecture](architecture/ARCHITECTURE.md) in its shape, but builds only the parts today's behaviors need. This document lists what is left to build, and in which order where that is decided; [`IMPLEMENTATION.md`](IMPLEMENTATION.md) describes the bot as it is.

## Next

- **Refused orders as Beliefs events** ([4.1](architecture/ARCHITECTURE.md#41-one-mind-two-boundaries)). A refusal reaches the part of the mind that gave the order through a callback on the order queue. The architecture delivers it with the next tick's observations, among that tick's events in Beliefs, where a belief model keeps what should last.

## Later

- **A typed decision record** ([4.14](architecture/ARCHITECTURE.md#414-the-decision-record)). The record is free-form notes. Typed, it holds every decision with its reason, including what the notes lack today: the Directives, each unit's chosen behavior, and Allocation's denials.
- **Build orders and the opening book** ([4.11](architecture/ARCHITECTURE.md#411-strategy-playbooks-and-production)). A playbook's `BuildOrder`, its opening buildings and worker targets, covers part of the architecture's opening book and production goals. The two are to be reconciled.

## Temporary exceptions

- **Probes.** The mind still calls Warcraft directly for the orders whose acceptance is a test, such as building placement and tree harvests, and for two static reads. Replacing them needs that knowledge in Knowledge and Beliefs, such as where buildings fit and which destructables are trees. Without probes, a run's force can keep the units a reflex claimed, and the reflex can run with the rest of the Unit Behaviors, after the Intentions.
- **Knowledge** is a stub. Static facts come from Perception, and game data, such as costs, sits in the modules using it. With the costs in Knowledge, one place can check that each run spends only the money reserved for it.

## Not built yet

Each part comes when a behavior needs it.

- **Beliefs** ([4.3](architecture/ARCHITECTURE.md#43-beliefs-and-knowledge)): own units' types, mana, cooldowns, and items; heroes, production queues, upgrades, and food; the neutral, map, and events sections.
- **The enemy model** ([4.12](architecture/ARCHITECTURE.md#412-the-enemy-model)): contacts, which remember what is out of sight; inferred tech; where unseen units probably are; strategy recognition; the army estimate; scouting coverage. The enemy Beliefs hold only the units in sight and, from the start locations, where the enemy started.
- **Assessments** ([4.4](architecture/ARCHITECTURE.md#44-assessments)): none yet. Each module interprets the Beliefs for itself, in its `*.judgments.ts`.
- **Desires** ([4.5](architecture/ARCHITECTURE.md#45-desires)): weights in gold instead of placeholders; opportunities and their windows.
- **Intentions** ([4.7](architecture/ARCHITECTURE.md#47-intentions)): the idle, starved, and running progress; interruption costs and uninterruptible steps; cleanup Directives when an Intention is aborted or dropped; stall monitoring.
- **Allocation** ([4.8](architecture/ARCHITECTURE.md#48-allocation)): minimums and fighting strength, preferences, stickiness and the switching rule, a projection of income, food, recorded denials with the cause of each starvation, and explicit default owners.
- **Execution** ([4.9](architecture/ARCHITECTURE.md#49-execution), [4.10](architecture/ARCHITECTURE.md#410-opportunities-and-latitude)): Tactics; a Directive's role, latitude, station, and fallback; skills and opportunities; Unit Behaviors chosen by unit type, whose modules return verdicts with reasons; a Directive ending when its unit changes owner.
- **Timing** ([4.2](architecture/ARCHITECTURE.md#42-a-tick-phase-by-phase), [4.13](architecture/ARCHITECTURE.md#413-timing)): deliberation early on a new threat, a broken expectation, or a lost unit; Intentions stepped early when they gain or lose a unit.

## Tests

No automated tests cover the mind yet. [Testability](architecture/ARCHITECTURE_TESTABILITY.md) describes the tests the architecture is built for.
