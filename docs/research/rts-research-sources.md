# Research: Sources and What They Contributed

Companion to [`rts-behavior-architecture.md`](rts-behavior-architecture.md). It records the sources read for its second iteration (October 2026): what each one contributed, and what it warned against. Section 5 lists the sources that were not reachable. Terms of the proposed architecture are set in _**bold italics**_, to tell them from the sources' own terms.

## 1. RTS bots

### PurpleWave (StarCraft: Brood War, Scala; github.com/dgant/PurpleWave)

**Adopted**

- Units and money are allocated in priority order every planning cycle. Each request is a _lock_: a matcher, a counter (minimum and maximum), a preference, and whether it can be interrupted.
  - Units held by a lock are kept only while the lock is renewed each cycle.
  - Preemption takes units only from lower-priority, interruptible holders.
  - The minimum is all-or-nothing.
  - Units the lock already holds are preferred over new candidates, which score 1.5× worse.
- Money is reserved in priority order against the stock plus about two seconds of projected income. Unmet requests report when they become affordable.
- A forward macro simulator places production requests, written as desired totals, at the earliest feasible time without taking resources from higher requests. Denied requests are reported with a reason.
- Combat uses two estimates:
  - a cheap strength estimate that sums unit value × health with modifiers;
  - judgment modifiers that shift the fight threshold: proximity to home, chokes, being caught, commitment and hysteresis.

  A full combat simulation is optional.

- Decision lists record a reason for each verdict, e.g. `decide(verdict, "Reason", condition)`. Per-unit action logs, denial reasons, and a change log of key decisions make the bot explainable.
- A destination stack keeps a unit's goal, fallback, and formation slot separate.
- Fog-of-war memory:
  - Each remembered unit has a visibility state: visible, nearby, missing, or dead.
  - Old entries decay, and positions of unseen units are projected forward.
  - "Fingerprints" are composable, timed predicates over what was observed. They recognize enemy openings.
- Work is spread over frames with weighted tasks and guaranteed maximum skips. Unit agents update round-robin, closest to a threat first. The bot falls back to cheaper algorithms when it runs slow.

**Avoided**

- A global mutable service locator (`With`). Its tests had to build state through `Unsafe` and reflection.
- Game plans written as imperative code that mixes desires, priorities, and flags.
- Priority that falls out of call order instead of an explicit list.
- Last-writer-wins unit intents.
- Frame-time overruns: the bot withdrew from a tournament over them.

### Steamhammer and UAlbertaBot (satirist.org/ai/starcraft/steamhammer, github.com/davechurchill/ualbertabot), with Jay Scott's blog

**Adopted**

- Phase separation in every frame: collect game state, analyze and plan, execute through one order sink. Jay Scott's posts 1018 and 1124 describe module-order dependencies as a lasting source of bugs.
- Planners declare the resources they need, priorities divide them, and plans whose needs cannot be met are cut (post 1124).
- One claim mechanism for every unit. Steamhammer's special cases for workers, scouts, and builders never stopped causing trouble, and its migration from "Squads" to "Teams" was still unfinished after years.
- Micro organized by role, not unit type (post 529). Plans that monitor their own progress (post 604).
- Fight-or-flight needs:
  - separate thresholds for advancing and retreating, and persistent decision state;
  - destinations for retreating that account for danger.

  Oscillating between advancing and retreating was Steamhammer's main tactical weakness for years.

- An exact opening language: items, `N x`, `@ location`, commands, barriers. Production goals that resolve prerequisites before committing. A single owner for reserved resources, which releases them on every exit path. Detection of production jams. Emergency reactions that record that they already fired.
- Fog memory whose ghosts are invalidated when their position is seen empty. Inference of unseen enemy tech by walking back through the tech tree.
- Coarse enemy-plan categories: Proxy, WorkerRush, FastRush, HeavyRush, SafeExpand, NakedExpand, Turtle.
- The skill interface: `enabled`, a cheap `feasible`, a careful `good`, `execute`, plus data and drawing hooks.

**Avoided**

- Global singletons.
- Several overlapping mechanisms for the same job, left half-migrated.
- Regrouping recomputed every frame without hysteresis.
- Learning that hides bugs: test with learning frozen.

### EISBot (github.com/bgweber/eisbot) and ABL reactive planning

Sources by Weber, Mateas, and Jhala:

- "Reactive Planning Idioms for Multi-Scale Game AI" (CIG 2010), read from an archived copy because the original host times out;
- "Applying Goal-Driven Autonomy to StarCraft" and "A Particle Model for State Estimation in Real-Time Strategy Games" (AIIDE 2010, 2011);
- Weber's PhD thesis (2012).

**Adopted**

- Typed requests that separate _what_ (strategy) from _how_ (specialists).
- Several alternative behaviors for one goal, tried in order of specificity, each with a success test and a context condition. Failure falls through to the next alternative.
- Expectations attached to a strategy: when one is violated, the strategy is reconsidered. Here they become _**adaptations**_ that guard the _**playbook**_'s assumptions and run _**Deliberation**_ early. "Expected X, not seen" may count only where scouting coverage says X would have been seen.
- A particle model for enemy units in the fog: one particle per enemy unit seen, with per-class decay and drift toward chokepoints, culled by our own vision.
  - Accuracy: 0.739 versus 0.669 for last-known positions.
  - In-game win rate: 78% versus 67%.
  - Perfect information did no better (67%). The authors attribute this to scouting, whose units also distracted the opponent.

**Avoided**

- An open blackboard where components couple through implicit producer/consumer conventions. Every manager depended on every other one.
- One active goal per level: EISBot could not attack in two places at once.
- A persistent goal per unit.
- Measuring the bot with full information.

### AMAI (github.com/SMUnlimited/AMAI), the main existing Warcraft III melee AI

**Adopted**

- Production goals as desired totals with priorities. Repeated copies interleave, waiting items age, and the bot stops at the first item it cannot afford, which saves for it implicitly. Prerequisites are added automatically. Gates pace tiers and upkeep.
- Hysteresis everywhere:
  - switching strategy needs 1.05× the current strategy's score, plus a minimum time on the current strategy;
  - a counter-unit choice is kept unless another scores 1.2× higher;
  - a town counts as threatened only after three cycles.
- Personality profiles (aggression, risk, attack threshold, strategy persistence) chosen per game.
- Warcraft-specific baselines:

  | Heuristic           | Baseline                                                                                 |
  | ------------------- | ---------------------------------------------------------------------------------------- |
  | Unit strength       | (food + level) / 2 × health fraction                                                     |
  | Hero strength       | 2 + 0.5 per level beyond 1, plus abilities                                               |
  | Creep camp strength | Levels × health, plus a bonus for the camp's color                                       |
  | Attack gate         | Own strength + aggression ≥ target's strength + towers (towers ×4 when we have no siege) |
  | Flee                | Enemy strength exceeds ours 2–3×                                                         |
  | Threat to a base    | Σ 540 × strength / distance^0.8, using projected army positions                          |
  - Hero escape: scored options when health drops below 30% or 100. Town Portal scores high when the hero is trapped or in dense enemy crowds, and low near home.
  - Focus fire: an enemy hero that can be killed first, then disabled units, then the lowest health.
  - Kiting: step 800 back from a melee unit within 200 that is not faster.
  - Wounded units are pulled back at 30% health.

- A mode that pits AMAI against Blizzard's AI: a cheap end-to-end benchmark.

**Avoided**

- Map-hacked inputs: enemy strength and army positions are read through the fog. AMAI also does no scouting.
- Blocking threads coordinated by global flags, and a 16,000-line file.
- Code generated from positional table columns.
- Dependence on engine AI natives (captains, creep-camp finders), which our _**tactics**_ and map knowledge replace.

## 2. BDI frameworks and research

### Jadex (download.actoron.com, activecomponents.org) and Jason (jason-lang.github.io)

**Adopted**

- A goal kind is a set of conditions over Beliefs rather than a class:
  - creation;
  - context (false suspends the goal);
  - drop;
  - target (achieved);
  - maintain, with a separate restore target for hysteresis;
  - recur, which retries later.
- Each goal has two state fields, lifecycle and processing, and every transition has a recorded reason.
- Candidate plans per goal, with a precondition, a priority, an exclude mode (which tried plans to skip), retry, and recur.
  - Abort hooks distinguish a plan aborted because its goal was achieved from one that was preempted.
- Jason's failure annotations (`no_applicable`, `action_failed`, …) as a model for recording why something failed.

**Avoided**

- Rule engines that propagate changes. Jadex's own documentation admits they miss changes inside complex objects.
- Abort-and-restart on suspension. Our _**methods**_ recompute their phase from _**Beliefs**_ when they resume.
- Event consumption that depends on loading order.
- Atomic intentions that block everything else.

**Not adopted**

- "Easy deliberation": inhibition between goal kinds, and cardinality limits. _**Context conditions**_ over _**Beliefs**_ and the identity of _**Desires**_ cover the cases the scenarios need, without a second mechanism.

### BDI research

- **de Silva, Meneguzzi, and Logan, "BDI Agent Architectures: A Survey"** (IJCAI 2020):
  - goal kinds;
  - plan-rules with context conditions (control flow as plan choice);
  - failure handling at the goal level;
  - intention scheduling.
  - An open problem it names: most BDI languages offer no deliberation over whether to _adopt_ a goal the agent generated itself. Our _**Deliberation**_ does exactly that.
- **Thangarajah, Harland, Morley, and Yorke-Smith, "Suspending and Resuming Tasks in BDI Agents"** (AAMAS 2008):
  - reasons to suspend a goal;
  - reconsideration conditions;
  - resumption as a fresh decision rather than an automatic continue;
  - in-conditions re-checked on resume;
  - suspend and resume hooks.
- **"Operational Behaviour for Executing, Suspending, and Aborting Goals"** (DALT 2010, published 2011), by the same authors:
  - perform, achieve, and maintain goals;
  - maintenance goals (our _**concerns**_) that only monitor, and spawn achieve goals: _recovery_ when their condition is violated, _prevention_ when a violation is predicted;
  - the states Pending, Waiting, Active, and Suspended;
  - _drop_ (discard) versus _abort_ (run cleanup methods).
- **Cohen and Levesque, "Intention Is Choice with Commitment"** (Artificial Intelligence 42, 1990). The _relativized_ persistent goal: an intention is given up when the agent believes it is achieved, believes it impossible, or no longer believes the reason it was adopted for. Dropping a supergoal is enough reason to drop its subgoals. "Persistent in pursuing its goals, but not fanatically so."
- **Harland, Morley, Thangarajah, and Yorke-Smith, "Aborting, Suspending, and Resuming Goals and Plans in BDI Agents"** (JAAMAS 31, 2017):
  - _drop_ halts a task; _abort_ halts it and runs cleanup; _suspend_ halts it after cleanup; _resume_ runs a procedure, then continues;
  - abort propagates children first, suspend and resume parents first;
  - cleanup methods belong to plans;
  - resumption is a deliberation, not automatic: "the agent must deliberate whether the task is still appropriate".
- **Thangarajah, Padgham, and Winikoff, "Detecting & Avoiding Interference Between Goals in Intelligent Agents"** (IJCAI 2003):
  - Interference takes two forms: an _in-condition_ broken during execution, and a _preparatory effect_ undone before the step that needs it.
  - Summary information of definite and potential conditions is computed from the goal-plan tree.
  - The incumbent wins by default.

  This grounds _**interruption cost**_ in what would actually be lost.

- **Vikhorev, Alechina, and Logan, "Agent Programming with Priorities and Deadlines"** (AgentSpeak(RT), AAMAS 2011):
  - Intentions are admitted in priority order while the set stays feasible, and the set is recomputed each cycle.
  - Infeasible intentions are dropped.
  - The bot commits to a priority-maximal set, and its reactivity delay is bounded.

  Our _**Allocation**_ has the same shape, and opportunities borrow the idea of a deadline.

- **Logan, Thangarajah, and Yorke-Smith, "Progressing Intention Progression"** (AAMAS 2017), and **Yao, Logan, and Thangarajah, "Robust Execution of BDI Agent Programs by Exploiting Synergies Between Intentions"** (AAAI 2016):
  - Logan et al. define the intention progression problem: which plan to use, and which intention to progress next. The state of practice is round-robin or hand-crafted scheduling.
  - Yao et al.'s MCTS scheduler finds synergies between intentions, but searches every cycle. That is too costly for Lua now, and explicit ownership of units and resources already removes most interference.
- **Winikoff and Cranefield, "On the Testability of BDI Agent Systems"** (JAIR 51, 2014):
  - Failure handling multiplies the number of paths through a goal-plan tree. One small tree goes from 128 successful paths to 6.3 × 10¹².
  - Failure paths are both more numerous and rarely reached.
  - Hence: shallow goal structures, few alternatives, and recovery that is explicit, local, and named.

## 3. Game AI practice

### Game AI Pro (www.gameaipro.com)

- **Dill, "Dual-Utility Reasoning"**: each option has a _rank_ (category) and a _weight_ (utility within the category). Only the best rank competes. Weight 0 vetoes an option.
- **Dill and Dragert, "Modular AI"**:
  - considerations that combine addends, multipliers, and ranks;
  - goal inertia (hysteresis) as an ordinary consideration;
  - status text over agents;
  - replaceable time and random source for deterministic tests.
- **Straatman et al., "Hierarchical AI for Multiplayer Bots in Killzone 3"**:
  - commander, squad, and bot layers;
  - a small vocabulary of orders;
  - orders as constraints ("a corridor") rather than micromanagement;
  - feedback limited to completion, imminent failure, and threats seen;
  - bots may "temporarily ignore orders in order to survive";
  - a planner rerun at a fixed rate, with continuation conditions that keep the current plan.
- **Côté, "Reactivity and Deliberation in Decision-Making Systems"**:
  - reactions and deliberation as separate modules joined by an action selector;
  - hysteresis on derived facts such as "threat seen".
- **Brewer, "Knowledge is Power"**:
  - Plan the data before the algorithm.
  - Remember "last known" positions with time since seen and how the fact is known.
  - Occupancy-style inference of where unseen units are.
- **Young, "Debugging AI with Instant In-Game Scrubbing"**: decision traces kept in a fixed-size ring buffer, with channels.
- **Skarupke, "Automated AI Testing"**:
  - Small, specific tests.
  - "Most AI bugs are reproducible with two characters".
  - Assertions of the form "within N seconds" rather than exact frames.
- **Dawe et al., "Behavior Selection Algorithms"**: no one formalism suits every level.

### Game Programming Patterns (gameprogrammingpatterns.com)

- **Service Locator.** "First consider _passing the object to it instead_." Locators are for ambient services such as logging.
- **Event Queue.** "You only need a queue when you want to decouple something _in time_". A central queue is a global variable.

### Testing practice in other projects

- **AMAI's tests.** They run the production JASS against fake natives, with one fresh game per test.
- **sharpy-sc2.** Its tests need hand-written mocks of about 160 lines, because the reasoning code reads the engine wrapper directly. That cost shows why our boundary matters.
- **0 A.D.** Headless autostart with seeds, and replays as logs of commands with per-turn state hashes.
- **microRTS.** A deterministic forward model, with partial observability added as a wrapper.

## 4. Warcraft III knowledge used

Four Liquipedia pages were read through web.archive.org: Experience, Creeps (camp colors), Daytime, and Items. The architecture document uses game mechanics only as examples of _**Knowledge**_, not as checked values. The source catalogue gives the current patch as 3.0.1 (build 24342, 7 October 2026); check game data and _**playbooks**_ against it before writing them.

## 5. Gaps

These sources were not reachable from the research environment:

- **liquipedia.net:** the site answers 403 to the environment; only the four archived pages above were read.
- **warcraft-gym.com:** answers 429.
- **webdocs.cs.ualberta.ca:** the site is down.
- **The GOAL programming guide:** blocked. The GOAL wiki was read instead.
- **Rao and Georgeff, "BDI Agents: From Theory to Practice"** (1995), and **Bratman, Israel, and Pollack's IRMA paper** (1988): they could be downloaded, but they are image-only scans with no text layer. They are described here through the papers that discuss them.
- **Duff, Harland, and Thangarajah, "On Proactivity and Maintenance Goals"** (AAMAS 2006): not found online. The proceedings are missing from ifaamas.org.
- **pdfs.semanticscholar.org:** blocked.

None of them blocks the architecture work. Liquipedia and Warcraft 3 Gym matter later, for game data and _**playbook**_ content. Game data should rather come from the game files themselves (CASC extraction), versioned by client build.

The research also skipped several areas for budget:

- a dedicated study of combat models (SparCraft, Lanchester-law prediction, FAP);
- terrain-analysis algorithms (BWTA, BWEM);
- several Game AI Pro chapters: Days Gone squad coordination, pitfalls of behavior trees, choosing considerations.

They belong to the implementation of their parts, not to the architecture.
