# Architecture Testability

How **Chain of Command** makes the bot easy to test. It uses the terms of the [architecture](architecture.md), set in _**bold italics**_ and defined in the [glossary](glossary.md).

The project asks for three kinds of tests. This document describes the properties of the architecture that make them easy, not a test plan.

**Easy scenario setup:**

- A scenario is plain data: a small _**Knowledge**_ fixture, the initial own state, and a timeline of _**observations**_, or built _**Beliefs**_ and _**Assessments**_.
- One fresh _**mind**_ runs each test.
- Randomness is seeded, and time advances only when the test steps it.
- Skarupke's observation that "most AI bugs are reproducible with two characters" suggests small first scenarios: one hero against one creep, one Wisp and one mine.

**Wide behavioral tests without Warcraft:**

- Everything between the boundaries runs on synthetic _**observations**_.
- Each step can also be tested alone: an _**assessment**_ or _**strategy recognition**_ from a _**Beliefs**_ fixture, and _**Desires**_ and _**Deliberation**_ from given _**Beliefs**_ and _**Assessments**_, without simulating how a threat was detected.
- Tests assert on the _**decision record**_ at the coarsest level that pins the behavior. For example: defense ranks above the expansion and receives the army. That is more robust than asserting exact orders.
- Every nondeterministic choice is either a deterministic tie-break or drawn from the injected random source. Small _**plans**_ and _**Tactics**_ can therefore be tested exhaustively, by forcing each step to succeed or fail.
- Bounded failure handling keeps that space small enough to cover.

**End-to-end tests in the game:**

- The same _**mind**_ runs with the real _**Perception**_ and executor.
- Privileged setup code builds the scenario on a test map.
- Opponents are scripted dummies or Blizzard's AI. AMAI's mode pitting AMAI against Blizzard's AI is a cheap benchmark.
- Assertions are predicates "within N seconds", not exact frames.
- Each run saves its _**decision record**_.

**What the architecture avoids for this reason:**

- Warcraft calls outside the two boundaries;
- timers, sleeps, or callbacks inside reasoning;
- module-level state;
- unseeded randomness;
- iteration order that depends on handles;
- generic retry.

**Open questions:**

- Whether engine-less tests run the TypeScript in Node, or the compiled Lua bundle in a standalone Lua 5.3. The latter tests what ships.
- How Warcraft III can be launched straight into a test map, at speed, with a fixed seed. No source covers that; it needs an in-game probe.
