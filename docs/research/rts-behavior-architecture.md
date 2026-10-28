# Research: Architecture for Full RTS Gameplay

Status: a proposed architecture, for discussion; second iteration (18 October 2026). It is not the adopted architecture; that remains [`ARCHITECTURE.md`](../ARCHITECTURE.md), summarized together with the current implementation in [`ARCHITECTURE_SITEMAP.md`](../ARCHITECTURE_SITEMAP.md). The first iteration is in the Git history of this file.

Companions:

- [`rts-architecture-introduction.md`](rts-architecture-introduction.md): a tutorial introduction; start there if the architecture is new to you.
- [`rts-scenario-analysis.md`](rts-scenario-analysis.md): the Night Elf versus Human scenarios, the requirements they imply, and how every deviation is handled.
- [`rts-research-sources.md`](rts-research-sources.md): the sources read and what each one contributed or warned against.
- [`rts-ideas.md`](rts-ideas.md): techniques that could fill parts of the architecture but that it does not depend on, such as particles for unseen units.

Terms of the architecture are set in _**bold italics**_; the introduction's [glossary](rts-architecture-introduction.md#17-glossary) defines them.

## 1. Summary

The first iteration proposed _**Intentions**_ that declare what they need, served in one priority order, and a chain of execution down to every unit. The second iteration researched:

- strong RTS bots: PurpleWave, Steamhammer and UAlbertaBot, EISBot;
- AMAI, the main existing Warcraft III melee AI;
- the Jadex and Jason BDI frameworks, and BDI research on goal lifecycles and testability;
- professional game AI practice.

That research confirmed the core of the first iteration and changed most of what surrounds it. The main decisions:

1. **One deterministic _mind_ behind two plain-data boundaries.** _**Perception**_ turns Warcraft into _**observations**_, and the _**order executor**_ turns orders into Warcraft calls. Everything between them is TypeScript over plain data:
   - units are identified by ids, not handles;
   - game time comes in with the _**observations**_;
   - one seeded random source is passed in;
   - static _**knowledge**_ is supplied when the _**mind**_ is created.

   This one boundary serves three purposes: fair information, testing, and explaining decisions.

2. **Fixed phases per tick, and a _decision record_.** Each tick observes, revises _**Beliefs**_, deliberates and allocates on cadence, steps _**Intentions**_, decides per unit, and executes. No phase depends on another being updated first. Every phase records why it decided what it did.
3. **Interpretation has explicit homes.** _**Beliefs**_ hold what was seen and what is probably true. _**Assessments**_ hold what it means for the bot, shared by every part that needs it, such as the threat to a base. An interpretation only one module needs stays private in that module, and how the game works is _**Knowledge**_.
4. **_Desires_ are asked for, not pushed.** Each _**deliberation**_ cycle collects _**proposals**_ from three sources: _**concerns**_ (maintenance goals, in BDI terms), the committed strategy's _**playbook**_, and the active _**Intentions**_' _**requests**_. There are no support ids, refresh intervals, or staleness.
5. **_Deliberation_ ranks, and commitment is explicit.** A _**Desire**_ has a _**rank**_ (a category) and a _**weight**_ (its value within that category, in gold):
   - _**pause conditions**_ over _**Beliefs**_ settle logical conflicts;
   - _**Allocation**_ settles competition for resources;
   - a _**switching rule**_ makes preemption deliberate: within a _**rank**_, a challenger must beat a unit's holder by the _**switching margin**_: a _**commitment constant**_ plus what interrupting the holder would waste.
6. **_Intentions_ are goals with _plans_.** An _**Intention kind**_ declares its conditions, its _**plans**_, its _**requests**_, and how it handles failure. One small generic runtime chooses _**plans**_, handles failure in a bounded, named way, and keeps every state change with its reason.
7. **_Allocation_ is the only owner of units and money.** _**Needs**_ are served in _**agenda**_ order and renewed every cycle. Money is reserved against stock plus projected income. Workers, scouts, and builders are not special cases.
8. **Execution keeps the first iteration's chain, with a fitting formalism at each level.**
   - _**Plans**_ are re-entrant state machines.
   - _**Tactics**_ keep a group's fight-or-flight state with hysteresis.
   - _**Unit Behaviors**_ let _**reflexes**_ preempt ordered _**skills**_, _**opportunities**_, and the _**task**_.
   - _**Directives**_ are constraints, not micromanagement, and units may deviate from them to survive.
9. **The infrastructure shrinks.** These are dropped:
   - Scoped Beliefs and their runtime;
   - assemble functions and child factories;
   - per-component Common Beliefs declarations;
   - desire supports;
   - capability providers that act for the running update;
   - Actor Control.

   Components become plain objects owned by their parents, and _**Beliefs**_ become one world model.

The bot answers five questions, each in one place:

| Question                                                                             | Answered by                                                                                        |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **Know**: what is true, was seen, or is probably true, and what does it mean for us? | _**Beliefs**_ (memory and inference), _**Assessments**_, and static _**Knowledge**_                |
| **Want**: what would be worth achieving now?                                         | _**Desires**_ proposed by _**concerns**_, the _**playbook**_, and _**Intentions**_' _**requests**_ |
| **Commit**: what do we pursue, and in which order?                                   | _**Deliberation**_: _**Intentions**_ and the _**agenda**_                                          |
| **Allocate**: who gets which units, gold, lumber, and food?                          | _**Allocation**_: _**needs**_ served in _**agenda**_ order                                         |
| **Act**: how is each commitment carried out, unit by unit?                           | _**Intention**_ → _**plan**_ → _**Tactic**_ → _**Directive**_ → _**Unit Behavior**_ → order        |

## 2. Requirements

The brief fixes one point: _**Beliefs**_, _**Desires**_, and _**Intentions**_ keep their purpose and meaning. _**Beliefs**_ are what the bot holds true, _**Desires**_ what it would find worth achieving, and _**Intentions**_ what it has committed to and how it pursues them. Every other concept of the current architecture was free to change. The design must be as simple as possible, but not simpler.

The [scenario analysis](rts-scenario-analysis.md#2-requirements-from-the-scenarios) derives R1–R13 from the scenarios; the project adds R14–R18.

| Requirement                                                                                                                                                  | Met by                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1: Commitment with replaceable _**plans**_                                                                                                                  | _**Intention kinds**_ with several _**plans**_, which the generic runtime chooses and replaces (4.7)                                                                  |
| R2: Interruption without loss                                                                                                                                | _**Starved**_ and paused _**Intentions**_ keep their state; _**plan runs**_ are re-entrant; the _**switching rule**_ weighs named _**interruption costs**_ (4.7, 4.8) |
| R3: One priority order for contested assets                                                                                                                  | The _**agenda**_, and _**Allocation**_ of units and money in its order (4.6, 4.8)                                                                                     |
| R4: Situations create _**Desires**_                                                                                                                          | _**Concerns**_ and _**playbook**_ rules over _**Beliefs**_ and _**Assessments**_, asked every cycle (4.4, 4.5)                                                        |
| R5: Bounded opportunism                                                                                                                                      | _**Latitude**_ in _**Directives**_, opportunity _**windows**_, and one value test at every level (4.9, 4.10)                                                          |
| R6: _**Reflexes**_ faster than _**deliberation**_                                                                                                            | _**Unit Behavior**_ _**reflexes**_ every tick, whoever owns the unit (4.9, 4.13)                                                                                      |
| R7: Group combat as a skill                                                                                                                                  | _**Tactics**_: persistent fight-or-flight state, the _**combat estimate**_ with named modifiers, pickers (4.9)                                                        |
| R8: Unit- and hero-specific play                                                                                                                             | A _**Unit Behavior**_ per unit type, _**roles**_ in _**Directives**_, hero builds in _**playbooks**_ (4.9, 4.11)                                                      |
| R9: Knowledge under uncertainty                                                                                                                              | _**Contacts**_ with age and provenance; inferences with confidence: unseen units, _**strategy recognition**_, coverage (4.3, 4.12)                                    |
| R10: Space and time                                                                                                                                          | Map knowledge, the map in _**Beliefs**_ as it changes, navigation, the _**danger assessment**_, travel time, projections, opportunity _**windows**_ (4.3–4.5)         |
| R11: Consistent mechanics                                                                                                                                    | One set of _**Knowledge**_ data and functions, and shared _**Assessments**_ (4.3, 4.4)                                                                                |
| R12: Strategy as an adaptable game plan                                                                                                                      | _**Playbooks**_: phases, an _**opening book**_, production goals, _**adaptations**_ (4.11)                                                                            |
| R13: Explainability                                                                                                                                          | A reason with every decision and every _**assessment**_, kept in the _**decision record**_ (4.4, 4.14)                                                                |
| R14: Testability. Scenarios are easy to set up; wide behavioral tests cover everything except the Warcraft III integration; end-to-end tests run in the game | Two plain-data boundaries, injected inputs, one root per game, the _**decision record**_ (4.1, 5)                                                                     |
| R15: Bounded work. Lua inside the game's own thread, up to about a hundred own units, a 0.1 s tick                                                           | A pace for each kind of work, and costs measured in the game (4.13, risk 4)                                                                                           |
| R16: Maintainability. Every decision has one home, game plans read as data, no framework grows beyond a demonstrated need                                    | One home per behavior (7), _**playbooks**_ as data, a small generic runtime (4.7, 4.11)                                                                               |
| R17: Fair information. Reasoning sees only what a player could see                                                                                           | _**Perception**_, the only reader of Warcraft, filters by visibility; _**Beliefs**_ hold _**contacts**_, not enemy units (4.1, 4.3)                                   |
| R18: Static _**knowledge**_ prepared offline. Everything deducible from the map and game files comes from build-time tooling                                 | _**Knowledge**_ supplied when the _**mind**_ is created, read through pure functions (4.3)                                                                            |

## 3. Principles

1. **One _mind_, two boundaries.** Only _**Perception**_ reads Warcraft, and only the _**order executor**_ writes to it. Everything between them is plain TypeScript over plain data. That single boundary enforces fair information, makes testing possible, and makes decisions explainable.
2. **One home per decision.** Knowing, wanting, committing, allocating, and acting at each level are each answered in exactly one place.
3. **Phases, not module order.** Each tick runs fixed phases. A phase reads only _**Beliefs**_ and what earlier phases produced.
4. **Explicit and explained.** Priorities form an explicit _**agenda**_, ownership is an explicit allocation, and every decision records its reason.
5. **Deliberate commitment.** Every switch has explicit inertia: of strategy, _**plan**_, target, fight or flight, or a unit's owner.
6. **Bounded failure handling.** Few alternatives, named recovery, limited attempts, and no generic retry. Failure handling is what makes a BDI program's behavior space explode.
7. **Data where data suffices.** Game plans, openings, production goals, and unit data are typed data; _**judgments**_ are small pure functions.
8. **Bounded work.** Every layer runs only as often as its answers can change, and costs are measured in the game before anything is optimized.

## 4. Architecture

### 4.1 One mind, two boundaries

```text
             observations                                                            orders
Warcraft ──▶ Perception ──▶ ┌──────────────────────── mind ────────────────────────┐ ──▶ Order executor ──▶ Warcraft
                            │ Beliefs ─▶ Assessments ─▶ Desires ─▶ Deliberation ─▶ │
                            │ Allocation ─▶ Intentions ─▶ Unit Behaviors           │
                            └──────────────────────────┬───────────────────────────┘
                                                       ▼
                                                decision record ─▶ debug overlay, logs, traces, tests
```

- _**Perception**_ is the only code reading Warcraft state for decisions. It produces _**observations**_:
  - own units;
  - visible enemy and neutral units;
  - items on the ground;
  - game time;
  - what happened this tick: attacks on own units, deaths, spells cast by visible units, constructions started, and the outcome of last tick's orders.

  It filters by visibility, which is where fair information is enforced.

- **Unit ids.** The _**mind**_ never holds Warcraft handles. _**Perception**_ gives each unit an id for its lifetime and keeps the map from ids to handles. Orders name units by id, and the executor maps them back.
- **The _order executor_** is the only code issuing Warcraft orders.
  - It skips an order equal to what the unit is already doing, because a re-issued attack restarts it.
  - It records each order's reason.
  - When Warcraft refuses an order, the refusal reaches the _**mind**_ with the next tick's _**observations**_, 0.1 s later. _**Beliefs**_ hold it among that tick's events, and a _**belief model**_ keeps what should last, such as what a shop has in stock after a purchase failed.
- **Inputs are injected.**
  - Game time arrives with the _**observations**_.
  - One seeded random source is passed in.
  - Static _**Knowledge**_ (game data and map knowledge) is supplied when the _**mind**_ is created.

  Nothing in the _**mind**_ reads a clock, a random generator, or a data file by itself.

- **One root per game.** The _**mind**_ is created for one game and holds all its state in its closure; there is no module-level state. A fresh _**mind**_ is a fresh game.

```ts
// The runtime shell (sketch): the only code touching both boundaries.
const mind = createMind({
  knowledge,
  playbooks,
  random: seededRandom({ seed }),
});

onEveryTick(() => {
  const { orders, record } = mind.step({ observations: perception.observe() });
  executor.execute({ orders });
  logDecisions({ record }); // what changed, in log files of its own
});
```

### 4.2 A tick, phase by phase

| Phase                                         | Runs                                                                 | Reads                                                                            | Produces                                                              |
| --------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1. Revise _**Beliefs**_ and _**Assessments**_ | every tick                                                           | _**observations**_, previous _**Beliefs**_ and _**Assessments**_                 | _**Beliefs**_, then _**Assessments**_                                 |
| 2. Collect _**Desires**_                      | each _**deliberation**_ cycle (about 1 s), or early on urgent events | _**Beliefs**_, _**Assessments**_, active _**Intentions**_                        | _**Desires**_ with their _**proposals**_                              |
| 3. Deliberate                                 | with phase 2                                                         | _**Beliefs**_, _**Assessments**_, _**Desires**_, _**Intentions**_                | _**Intentions**_ adopted, kept, paused, or finished; the _**agenda**_ |
| 4. Allocate                                   | with phase 2, and when units appear or die                           | _**Beliefs**_, the _**agenda**_, _**needs**_                                     | each _**Intention**_'s force: units and money                         |
| 5. Step _**Intentions**_                      | each _**Intention**_ at its cadence, in _**agenda**_ order           | _**Beliefs**_, _**Assessments**_, its force                                      | _**Directives**_                                                      |
| 6. Decide per unit                            | every tick                                                           | _**Beliefs**_, _**Assessments**_, each unit's _**Directive**_, the unit's memory | orders                                                                |
| 7. Record                                     | every tick                                                           | everything decided                                                               | the _**decision record**_                                             |

**No phase depends on another being updated first.** No phase calls into a later one, and no component relies on another having run before it. That removes the "must run before X" ordering that kept producing bugs in Steamhammer.

**Some events run phases 2–4 on the next tick** instead of waiting for the next cycle: a threat appearing, a broken _**expectation**_, an _**Intention**_ finishing, a unit lost.

### 4.3 Beliefs and Knowledge

**_Beliefs_ are one world model, as plain data.** _**Belief models**_ revise it, each one a pure function that owns a section: it takes the previous section and the _**observations**_, and returns the next section. To everything else, _**Beliefs**_ are read-only.

| Section                  | Contents                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Self                     | Own units: type, position, life, mana, cooldowns, current order, items. Heroes: level, experience, skills. Buildings and their queues, upgrades, gold, lumber, food and upkeep, Moon Well mana.                                                                                                                                                                                                                                 |
| Enemy _**contacts**_     | Every enemy unit and structure seen, with: last known position; life and mana while visible; time since seen; how it is known (seen or inferred); visibility (visible, recently seen, missing, gone); confidence. Heroes with level and items seen. Bases.                                                                                                                                                                      |
| Enemy inferences         | Tech inferred from requirements; where unseen units probably are; army estimate and projected movement; hero whereabouts; the recognized enemy strategy; scouting coverage.                                                                                                                                                                                                                                                     |
| Neutral                  | Creep camps (alive, wounded, cleared, last seen); items on the ground; shop and Tavern stock when seen.                                                                                                                                                                                                                                                                                                                         |
| Map                      | The map as the bot believes it now: trees and destructibles seen destroyed, and how the regions connect given those and the structures standing, including the chokes and which unit sizes fit through.                                                                                                                                                                                                                         |
| Time                     | Game time; day or night.                                                                                                                                                                                                                                                                                                                                                                                                        |
| Events                   | What happened this tick, kept for this tick only: attacks on own units, deaths seen, spells seen, order outcomes. Whatever must last, a _**belief model**_ records in another section.                                                                                                                                                                                                                                          |
| _**Knowledge**_ (static) | The game and the map as they are when the game starts. **Game data:** units, heroes, abilities, items, upgrades, requirements, costs, build times, damage and armor tables, experience rules. **Map knowledge:** terrain and its pathing by unit size, trees and destructibles, regions, start locations, bases and their gold mines, creep camps with their creeps and item drops, shops, Taverns, Mercenary Camps, fountains. |

- **_Contacts_, not actors.** Enemy _**beliefs**_ record what the bot saw and inferred, never the enemy units themselves. A remembered "ghost" becomes invalid when its position is seen empty.
- **Uncertainty stays uncertainty.** Inferred _**beliefs**_ carry confidence and age.
- **Projections enable prevention.** Proactive maintenance needs _**beliefs**_ about the near future: the food queued production will use, when a threatening army will arrive, when research completes. _**Concerns**_ act on these before a condition breaks; in an RTS, reacting after it breaks is too late.
- **Derived facts are filtered once.** Facts that drive decisions, such as an enemy army being near, get their hysteresis where they are inferred, not in every consumer.
- **_Knowledge_ is the game as it starts.** It never changes during a game; anything that can, however rarely, is a _**Belief**_ or an _**Assessment**_. Trees are cut down and structures go up, opening and closing routes, so _**Beliefs**_ hold the map as the bot believes it now. Changes arrive through _**Perception**_ like any other _**observation**_, so a route cut in the fog stays closed in _**Beliefs**_ until it is seen.
- **_Knowledge_ is data, supplied when the _mind_ is created and read like _Beliefs_.** Tests can then give it a two-region map and a handful of unit types, with no code involved.
  - _**Knowledge**_ functions live beside the data, not on it: the _**combat estimate**_, navigation, damage, production time, requirements. They are pure and imported where needed, and they take what they need as arguments: the data from _**Knowledge**_, and what changes from _**Beliefs**_ and _**Assessments**_. Each can be tested alone, with exactly the inputs it names.
  - They keep no state between calls, since the _**mind**_ has no module-level state. Whatever they precompute is data: computed offline into _**Knowledge**_, or kept in _**Beliefs**_ by a _**belief model**_.
- **No Scoped Beliefs.** A fact several components need is a _**Belief**_; anything else is a component's execution state.
- **_Beliefs_ are not _Assessments_.** _**Beliefs**_ say what is, or is probably, true. What that means for the bot belongs to _**Assessments**_ ([section 4.4](#44-assessments)).

**Navigation** is the _**Knowledge**_ function every part uses to move around the map. It reads only the bot's own information, never Warcraft: the map as built from _**Knowledge**_, the map as believed now from _**Beliefs**_, and the danger of each region from the _**danger assessment**_. It answers three questions:

- **Can a unit of this size get there?**
- **How long does it take?** _**Allocation**_ uses this to prefer the nearest units and to check that they arrive in time, proposers to check a _**window**_, and the _**threat assessment**_ to tell when an enemy army arrives.
- **Which way?** It returns a route through regions and chokes, as waypoints, weighing each region's danger by how much danger the caller accepts: none for the Wisp walking to the Tavern, some for an army.

Navigation plans only from region to region. Between waypoints, Warcraft's own pathfinder moves each unit around trees, buildings, and other units, as it does for a player's orders. Following a route is the Travel _**Tactic**_'s job ([section 4.9](#49-execution)).

### 4.4 Assessments

_**Beliefs**_ say what is, or is probably, true. **_Assessments_ say what it means for the bot.** Five Footmen at the Wisps are a fact. Whether they are a serious threat depends on what defends the Wisps: two Archers, or a ring of Ancient Protectors. That judgment is an _**assessment**_. The distinction is the adopted architecture's: "Belief is not assessment".

| Assessment        | Says                                                                                                                                                                                                                            | Read by                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Threats           | each threat to own assets: its target; the enemy's strength, discounted by distance and using projected movement, against what defends the target; when it arrives; its severity (lethal, serious, or small); the value at risk | _**concerns**_, _**pause conditions**_, worker _**reflexes**_                                                                        |
| Danger            | how dangerous each region is, from enemy _**contacts**_, their projected movement, and towers                                                                                                                                   | navigation, _**Tactics**_, _**plans**_ choosing camps and routes                                                                     |
| Relative strength | own army and economy against the enemy's estimates, now and at the _**playbook**_'s next timing; who gains from waiting, and how fast: the price of time, which also sets how much risk to accept                               | the _**playbook**_'s phase conditions and _**adaptations**_, the _**strategy concern**_, every _**weight**_ that prices time or risk |
| Map control       | which regions and camps each side holds or contests                                                                                                                                                                             | creeping and expansion _**plans**_, the _**playbook**_                                                                               |

**An interpretation is an _assessment_** when it interprets _**Beliefs**_ relative to the bot (its assets, its defenses, its strategy) and several parts need it and must agree on it. Take five Footmen at the Wisps: the defense decides how many units to send, and the Wisps decide whether to flee. If each judged the threat on its own, they could disagree: the Wisps could abandon their trees over a threat the defense thinks small, or the defense could send too few units against a threat serious enough to make the Wisps flee. Reading one _**threat assessment**_, both act on the same answer. Every interpretation has one home:

| Interpretation                                                                                                                | Home                                        |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| What was seen                                                                                                                 | _**Beliefs**_: _**contacts**_ and own state |
| What is probably true, such as the enemy's tech, strategy, and army                                                           | _**Beliefs**_: inference, with confidence   |
| What it means for the bot, needed by several parts                                                                            | an _**Assessment**_                         |
| What it means for one decision only, such as a _**Tactic**_'s view of its own fight or a _**plan**_'s choice of the next camp | a private _**judgment**_ in that module     |
| How the game works                                                                                                            | _**Knowledge**_                             |

**Inference or _assessment_?** Two questions decide:

- **Can it be checked against the truth?** Whether the enemy has Tier 2, or where his army is, has an answer that a test harness knows. That is inference, and it belongs to _**Beliefs**_. Whether a threat is serious has no such answer: it is a judgment, tuned for how well the bot plays.
- **Does it depend on what the bot wants or values?** Inference never does. A threat's severity depends on the value at risk, and relative strength on the _**playbook**_'s next timing, so both are _**Assessments**_.

Which strategy the enemy follows is a claim about the world, so recognizing it is inference ([section 4.12](#412-the-enemy-model)). Whether that strategy beats ours is an _**assessment**_. Keeping the two apart lets _**Beliefs**_ be measured against the truth, lets judgments be tuned without making _**Beliefs**_ less accurate, and keeps what the bot wants out of what it believes.

**How _Assessments_ work:**

- They are computed like _**belief models**_: pure functions over plain data, revised in phase 1, right after the _**Beliefs**_ they read, each at its own cadence ([section 4.13](#413-timing)). Inference and _**Assessments**_ are one kind of module with two kinds of output, not two subsystems.
- They are plain data, read-only to everything else. Like _**Beliefs**_, they never propose _**Desires**_: _**concerns**_, the _**playbook**_, and _**requests**_ read them and propose.
- An _**assessment**_ keeps memory where it needs it. A base counts as threatened only once a threat has persisted, and stays so until it has clearly passed. That hysteresis lives in one place, not in every reader.
- Each records its inputs, so the _**decision record**_ shows the whole chain, for example: "5 Footmen seen near the Wisps 2 s ago; strength 7.5 against 4.2 at home → serious threat to the main base → `DefendBase`, Emergency".
- An _**assessment**_ may be small, like threats, or a subsystem with its own structure, like danger over the whole map. Either way its output stays narrow.
- An interpretation is kept as an _**assessment**_ when it needs memory or has many readers. A pure, cheap question with one reader, such as the danger along one route, stays a function called when needed.

### 4.5 Desires

A _**Desire**_ is an outcome the bot considers worth pursuing. It carries no behavior and commits to nothing.

**A _proposal_ is one source backing one outcome:** which outcome, how strongly (_**rank**_ and _**weight**_), and why (reason). Sources make their _**proposals**_ afresh every _**deliberation**_ cycle. _**Proposals**_ for the same outcome merge into one _**Desire**_, identified by its outcome: its kind and its arguments. Two _**proposals**_ of `AcquireItem{Demon Hunter, Staff}` are one _**Desire**_; `RaidBase{north expansion}` and `RaidBase{east expansion}` are two. Nobody creates or deletes a _**Desire**_: it exists in every cycle in which at least one source proposes it, whether or not it has an _**Intention**_, and _**Deliberation**_ adopts at most one _**Intention**_ for it at a time.

- **Two kinds of outcome.**
  - _Achieve_ a state: `ReachTech{Tier 3}`, `AcquireItem{Demon Hunter, Staff of Teleportation}`, `ReviveHero{hero}`.
  - _Perform_ an activity: `Creep{heroes, until}`, `HarassEnemyHero{hero}`, `DefendBase{base}`, `Attack{objective}`.
- **_Concerns_ are not _Desires_.** A _**concern**_ is something the bot keeps caring about all game, such as "keep the bases safe" or "keep supply ahead"; BDI literature calls it a maintenance goal. A _**concern**_ watches a condition, and proposes an achieve or perform _**Desire**_ when the condition is violated (recovery) or predicted to be violated (prevention).

_**Desires**_ come from three sources, asked every _**deliberation**_ cycle:

| Source         | Owner                   | Examples                                                                                                                                                                                                                 |
| -------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| _**Concerns**_ | the bot                 | `DefendBase{base}` while threatened; `ReviveHero{hero}` while dead; `Scout{enemy start}` until known; `ExecuteStrategy{playbook}` for the preferred _**playbook**_; `RunEconomy`, `MaintainSupply`, and `Reserve` always |
| _**Playbook**_ | the committed strategy  | `TrainHero`, `ProduceArmy{composition}`, `Creep`, `HarassEnemyHero`, `RaidBase`, `HireHero`, `ReachTech`, `Attack`                                                                                                       |
| _**Requests**_ | active _**Intentions**_ | `AcquireItem{Demon Hunter, Staff}`, `ProtectUnit{Demon Hunter}`, `ClearCamp{camp at the expansion}`                                                                                                                      |

**A _proposal_ carries a _rank_, a _weight_, and a reason.**

- _**Rank**_ is the category: _**Survival**_, _**Emergency**_, _**Game plan**_, _**Opportunity**_, or _**Background**_.
- _**Weight**_ is the value within the _**rank**_, in gold, computed at runtime from _**Beliefs**_ and _**Assessments**_. A _**weight**_ of 0 vetoes the _**proposal**_.
- A _**Desire**_ takes its best _**proposal**_: the highest _**rank**_, then the highest _**weight**_.
- **Each proposer picks the _rank_ for the situation.**
  - The _**threat assessment**_ rates a threat lethal, serious, or small, and the _**base-safety concern**_ ranks it _**Survival**_, _**Emergency**_, or _**Game plan**_. A small threat, such as a lone Footman at the Wisps, competes by _**weight**_, so it cannot pull a hero off a more valuable commitment.
  - A raid is usually an _**Opportunity**_, but the _**playbook**_ may rank pressing a beaten army as _**Game plan**_.
- **Opportunities carry a _window_.** A _**proposal**_ for a short-lived gain states how long the chance lasts and how long pursuing it takes. A _**Desire**_ that can no longer fit its _**window**_, given travel time and the units available, gets _**weight**_ 0 instead of waiting for units.

**_Weights_ are measured in gold.** A _**weight**_ says how far pursuing the outcome would move the balance between the two sides, net of its risk: killing an enemy Peasant is worth its cost plus the mining the enemy loses, and losing one of ours costs the same. _**Knowledge**_ supplies costs, income, and experience; _**Beliefs**_ and _**Assessments**_ supply what is at stake and the risk. Two refinements make gold a fair measure:

- **Time is priced at the rate the balance moves**, which the relative strength _**assessment**_ provides ([section 4.4](#44-assessments)). With three mines against one, a minute moves the balance a lot, so time is dear and gold cheap. With our last mine against none, each minute adds to our lead: waiting earns something, so a risky attack must beat simply waiting.
- **The same answer sets how much risk to accept.** Ahead and gaining, the bot avoids big risks; behind and losing ground, it takes them.

The price of time changes over the game, but _**weights**_ are only compared within one cycle, so they stay comparable. The _**commitment constant**_ and _**interruption costs**_ are in gold too. The numbers in this document's examples are illustrative.

**Two _proposals_, one _Desire_.** While the Staff is out of stock and the harassment runs without it, two sources propose buying it:

| Source                             | Proposes                           | Rank            | Weight (gold) | Reason                         |
| ---------------------------------- | ---------------------------------- | --------------- | ------------- | ------------------------------ |
| the _**playbook**_'s Harass phase  | `AcquireItem{Demon Hunter, Staff}` | _**Game plan**_ | 280           | the phase wants an escape item |
| the harassment, as a _**request**_ | `AcquireItem{Demon Hunter, Staff}` | _**Game plan**_ | 320           | hit and run needs an escape    |

The _**Desire**_ ranks as its stronger _**proposal**_, _**Game plan**_ with 320 gold, and has at most one _**Intention**_. When the harassment ends, its _**request**_ goes with it, and the _**playbook**_'s _**proposal**_ alone keeps the _**Desire**_ alive. A _**Desire**_ nobody proposes disappears, and an _**Intention**_ still pursuing it is dropped.

**A _request_ belongs to its _Intention_.** It disappears as soon as the _**Intention**_ stops proposing it, or ends. Every _**Desire**_ is recomputed each cycle from the current _**Beliefs**_, _**Assessments**_, and _**Intentions**_.

```ts
// A concern (sketch): keep the bases safe, proposing recovery.
const keepBasesSafe: Concern = ({ assessments }) =>
  assessments.threats
    .filter((threat) => threat.against.kind === 'Base')
    .map((threat) => ({
      outcome: { kind: 'DefendBase', base: threat.against.base },
      rank: RankBySeverity[threat.severity],
      weight: threat.valueAtRisk,
      reason: `${threat.severity} threat to ${threat.against.name}`,
    }));

const RankBySeverity = {
  lethal: RANK.SURVIVAL,
  serious: RANK.EMERGENCY,
  small: RANK.GAME_PLAN,
};
```

### 4.6 Deliberation

Each cycle, _**Deliberation**_:

1. **Checks conditions.** It evaluates each active _**Intention**_'s conditions over _**Beliefs**_ and _**Assessments**_:
   - achieved: the _**Intention**_ is finished as achieved;
   - impossible: it is finished as failed, with the reason;
   - its _**pause condition**_ holds: it is paused, with the reason.
2. **Adopts.** For each valid _**Desire**_ without an _**Intention**_, it creates an _**Intention**_ of the kind registered for the outcome's kind.
   - A _**Desire**_ is valid when its best _**proposal**_ has a _**weight**_ above 0 and its outcome is neither achieved nor impossible, as its _**Intention kind**_'s conditions judge it. _**Deliberation**_ never adopts what would finish at once, and an _**Intention**_ that failed as impossible is adopted again only once its outcome is possible again.
   - A _**Desire**_'s identity keeps this to one _**Intention**_ per outcome: two _**proposals**_ to raid the same base are one _**Desire**_, and there is one strategy because the _**strategy concern**_ proposes only the _**playbook**_ it prefers.
   - **After giving up, the _Desire_ must lapse.** When an _**Intention**_ fails because its _**failure policy**_ gave up, its _**Desire**_ gets a new _**Intention**_ only after it has lapsed: no source proposed it for a cycle. Otherwise a _**Desire**_ proposed throughout would start the same attempts over and over. An _**Intention kind**_ that should try again later recurs instead ([section 4.7](#47-intentions)).
3. **Orders the _agenda_.**
   - _**Intentions**_ are ordered by _**rank**_, then by _**weight**_: by their value only. An _**Intention**_ has no _**rank**_ or _**weight**_ of its own; each cycle it takes its _**Desire**_'s, from the strongest _**proposal**_, so its place moves as the _**proposals**_ change. Switching costs apply only where one _**Intention**_ would take units from another ([section 4.8](#48-allocation)).
   - An _**Intention**_ is relative to the reason it was adopted for. Once its _**Desire**_ is gone, it is dropped, unless its run is in a step marked _**uninterruptible**_: a hero at the shop with gold reserved finishes the purchase first.
4. **Records reasons.** Every adoption, pause, and drop, and every _**agenda**_ position, is recorded with the _**ranks**_, _**weights**_, and vetoes that produced it.

**Conflicts between _Intentions_.** _**Deliberation**_ has no rules saying which _**Intention**_ blocks which. Conflicts come in two kinds, and each is settled elsewhere:

- **Competing for the same units or money.** _**Allocation**_ settles it in _**agenda**_ order ([section 4.8](#48-allocation)).
- **One makes no sense while another goes on**, such as building an expansion at a site under attack. The _**Intention**_ that should wait says so in its own _**pause condition**_: Expand pauses while the _**threat assessment**_ sees a threat at its site. It reads the same threat the defense answers, so neither _**Intention**_ refers to the other.

### 4.7 Intentions

An _**Intention kind**_ is a goal with:

- **Conditions over _Beliefs_ and _Assessments_:** achieved, impossible, and a _**pause condition**_: when it must wait for now, such as Creep while all its heroes are dead. Jadex states the same as a context condition, which must hold for a goal to proceed.
- **_Plans_:** each one is applicable (a precondition), has a preference, and starts a run.
- **_Requests_:** _**Desires**_ it proposes for goals it depends on but does not pursue itself, such as buying the Staff for its hero (`AcquireItem`) or covering its hero in trouble (`ProtectUnit`). A _**request**_ competes on the _**agenda**_ like any other _**Desire**_, so it gets units and money only by its own _**rank**_ and _**weight**_. If adopted, an _**Intention**_ of its own pursues it, and the requester sees the result in _**Beliefs**_, such as the Staff in the hero's inventory ([section 4.5](#45-desires)).
- **A _failure policy_:** how long a failed _**plan**_ is excluded, how many attempts are allowed, and then whether to recur, waiting and retrying, or to fail, giving up until its _**Desire**_ lapses ([section 4.6](#46-deliberation)).

**One small generic runtime does the means-end reasoning**, so _**Intention kinds**_ do not reimplement it.

- It chooses the best applicable _**plan**_, breaking ties deterministically, and steps its run.
- When a _**plan**_ fails, the runtime:
  - records the reason;
  - excludes the _**plan**_ for the time its policy says;
  - tries the next one.
- When no _**plan**_ applies, the _**Intention**_ pauses to recur or fails, as its policy says.

**An _Intention_'s state is two fields, each with a reason:**

| Field    | Values                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| State    | **active** · **paused**: its _**pause condition**_ holds, or it waits to recur until T · **finished**: achieved, failed, dropped, or aborted |
| Progress | **idle**: needs nothing now · _**starved**_: its _**needs**_ are unmet, held by Y · **running**                                              |

**Suspension needs no protocol of its own.**

- An _**Intention**_ whose _**needs**_ go unmet is _**starved**_. One whose _**pause condition**_ holds is paused. Either way it keeps its state, and it holds nothing that needs releasing, because _**Allocation**_ recomputes every round.
- Resuming is a decision, not a replay:
  - Before a _**starved**_ or paused _**Intention**_ is stepped again, its conditions and its reason are re-checked, and it may be dropped instead.
  - _**Plan runs**_ are re-entrant: when stepped again they work out their phase from _**Beliefs**_, and re-check the conditions they rely on.
- A _**starved**_ opportunity is dropped once its _**window**_ passes: its _**Desire**_ gets _**weight**_ 0, so the _**Intention**_ has lost its reason.

**Ending cleanly.** When an _**Intention**_ is aborted or dropped, its run gets one last call to return cleanup _**Directives**_, such as canceling queued production or calling back a builder. Only then does _**Allocation**_ take its units.

_**Plan runs**_ are small, explicit state machines. A run:

- declares its _**Intention**_'s _**needs**_;
- returns _**Directives**_: what each unit its _**Intention**_ owns should do ([section 4.9](#49-execution));
- reports its status;
- monitors its own progress: it has an expected progress and a stall timeout, after which it repairs itself, changes its steps, or fails;
- reports its _**interruption cost**_: what interrupting it now would waste ([section 4.8](#48-allocation)). A step that must not be interrupted at all, such as a Town Portal about to take effect or a purchase being made, marks itself _**uninterruptible**_ for a bounded time.

**Needs change over an _Intention_'s life.** Its current _**plan run**_ declares them anew every round, so they follow the run's progress and change when the runtime switches _**plans**_: HireHero needs nothing at first, then a Wisp, then the hero's gold and food ([section 6.2](#62-buying-the-second-hero)). Each step, the run receives its force, the units and money _**Allocation**_ last granted for those _**needs**_, as an argument, and returns _**Directives**_ rather than calling a capability. That makes it data in and data out.

```ts
// An Intention kind (sketch).
const creep = intentionKind<CreepGoal>({
  kind: 'Creep',
  achieved: ({ goal, beliefs }) => heroesReachedLevel({ goal, beliefs }),
  impossible: ({ beliefs }) =>
    reachableCamps({ beliefs }).length === 0 ? 'no camps left' : null,
  paused: ({ goal, beliefs }) =>
    anyHeroAlive({ goal, beliefs }) ? null : 'all heroes dead',
  plans: [creepWithArmy, creepWithAncientTank, soloHeroCreep],
  requests: ({ goal, beliefs }) => healingItemsWanted({ goal, beliefs }),
  failure: { excludeSeconds: 60, attempts: 3, whenExhausted: 'recur' },
});

// A plan's run (sketch).
interface PlanRun {
  needs({ beliefs }: { beliefs: Beliefs }): Needs;
  step({ beliefs, force }: PlanRunStepArgs): PlanStep; // status, directives, reason
  interruptionCost(): InterruptionCost; // named losses; uninterruptible until when
  abort({ reason }: { reason: string }): readonly Directive[];
}
```

The _**Intention kinds**_ the scenarios need:

| Intention kind                  | Adopted for                                     | Plans, for example                                               | Needs                                                    |
| ------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| RunEconomy                      | _**concern**_                                   | harvest toward worker targets                                    | workers (_**default owner**_), the main hall             |
| MaintainSupply                  | _**concern**_                                   | build ahead of predicted food                                    | a builder, money                                         |
| Reserve                         | _**concern**_                                   | gather near defenses, stay safe                                  | military units nobody else claimed (_**default owner**_) |
| ExecuteStrategy                 | _**concern**_, for the preferred _**playbook**_ | follow the _**playbook**_'s phases                               | nothing; it proposes _**Desires**_                       |
| ExecuteOpening                  | _**playbook**_                                  | follow the _**opening book**_                                    | builders, producers, money                               |
| ReachTech, ProduceArmy          | _**playbook**_                                  | construct, research, or train after resolving requirements       | builders, producers, money, food                         |
| TrainHero, HireHero, ReviveHero | _**playbook**_, _**concern**_                   | train at the Altar; hire through a visitor timed to readiness    | the Altar or a visitor, money, food                      |
| AcquireItem                     | _**requests**_, _**playbook**_                  | buy with the hero                                                | the hero, money                                          |
| Scout                           | _**concern**_, _**playbook**_                   | visit candidates by likelihood                                   | one cheap mobile unit                                    |
| Creep                           | _**playbook**_                                  | with the army; with an Ancient as tank; hero alone               | heroes, army strength suited to the camps                |
| HarassEnemyHero, RaidBase       | _**playbook**_                                  | hit and run; raid workers                                        | a mobile hero or units                                   |
| DefendBase                      | _**concern**_                                   | hold near defenses and Moon Wells; Town Portal or Staff when far | strength above the threat, arriving in time              |
| ProtectUnit                     | _**requests**_                                  | reach and cover                                                  | units able to reach in time                              |
| Attack                          | _**playbook**_                                  | choose the target, travel, siege, skirmish                       | an army above a minimum strength                         |
| Expand, ClearCamp               | _**playbook**_, _**requests**_                  | clear the site, then build                                       | a builder, money, an army                                |

**One _Intention_, several groups.** An _**Intention**_ pursues one _**Desire**_, but its _**plan**_ may need coordinated groups, such as an attack that pins the enemy army while the Demon Hunter hits the workers. The _**plan run**_ then declares one _**need**_ per group and steers each group with its own _**Tactic**_.

### 4.8 Allocation

The run of an _**Intention**_'s current _**plan**_ declares the _**Intention**_'s _**needs**_:

- **Unit _needs_:**
  - a matcher: a given unit, unit types, or a class such as army;
  - an amount: a count with a minimum and a maximum, or the fighting strength required, measured by the _**combat estimate**_;
  - a preference: closest by travel time, healthiest, already held.
- **Money _needs_:** gold, lumber, food.
- **Producers:** buildings are units, so they are matched like any other.

Each round, _**Allocation**_ walks the _**agenda**_ in order:

1. **Picks units.** An _**Intention**_ keeps the units it already holds first; this stickiness avoids churn. Then it gets free units, then units held by _**Intentions**_ lower on the _**agenda**_. Within each group it follows the _**need**_'s preference, and it stops as soon as the _**need**_ is met: a defense against one Footman takes the nearest Archer, not a hero from across the map. The _**switching rule**_ decides whether a unit may move from its holder:
   - nothing moves out of a step marked _**uninterruptible**_;
   - otherwise, a challenger with a higher _**rank**_ wins;
   - a challenger with the same _**rank**_ wins only if its _**weight**_ exceeds the holder's by the _**switching margin**_: a _**commitment constant**_ plus the holder's _**interruption cost**_.

   The _**decision record**_ keeps each term of the _**switching rule**_.

2. **Applies the minimum.** A _**need**_ whose minimum cannot be met gets nothing, so units are not wasted on a force too weak to act.
3. **Reserves money.** Money is reserved against the stock plus a short projection of income. An unmet _**need**_ reports when it becomes affordable; that is how saving works.
4. **Assigns leftovers to _default owners_.** Workers nobody asked for go to RunEconomy, army units and heroes to Reserve.
5. **Records every grant and denial with its reason.**

**The two terms of the _switching margin_:**

- The _**commitment constant**_ is one small _**weight**_, the same for every _**Intention**_: the least gain worth moving a unit at all. _**Weights**_ are recomputed every cycle and shift a little each time; without the constant, two _**Intentions**_ of close _**weight**_ would pass a unit back and forth.
- The _**interruption cost**_ is what taking the unit now would waste for its holder: a fight under way, a builder already at the site, a camp half cleared. The holder's _**plan run**_ names these losses from one shared list, and each named loss is valued in gold in one shared place, not by the _**Intention**_ reporting it. That keeps _**Intentions**_ written by different authors on one scale; a number each _**Intention**_ chose for itself would let it inflate its own priority. The cost follows the run's progress: interrupting a harassment that is still searching wastes little, interrupting one in a fight wastes the fight.

_**Allocation**_ rests on these rules:

- **_Needs_ are declared again every round.** An _**Intention**_ that ends, or stops needing a unit, loses it without having to release anything.
- **One owner per unit.** A production building belongs to ProduceArmy while it trains and to Creep while it tanks, never to both. A _**Directive**_ for a unit the _**Intention**_ does not own is rejected and recorded as a bug.
- **Reserved money is spent only by its holder.** Gold reserved for a hero is not spent on Archers.
- **Every _starvation_ has a named cause:** a higher _**Intention**_ that was served, or a holder the _**switching rule**_ protected. The _**decision record**_ holds it, and tests can assert it.
- **No special owners.** Workers, scouts, and builders are ordinary _**needs**_.

### 4.9 Execution

**Execution turns a commitment into orders, unit by unit.** Once _**Allocation**_ has given an _**Intention**_ its units, a short chain carries the _**Intention**_ out:

- its current _**plan**_ works through the steps of one way to pursue the goal;
- the _**plan**_ runs a _**Tactic**_ for each group of its units, which decides the group's fighting, movement, and positions;
- each _**Tactic**_ writes a _**Directive**_ for every unit in its group: what is asked of the unit, and within which limits;
- every unit's _**Unit Behavior**_ turns its _**Directive**_ into one order each tick, which the _**order executor**_ issues.

Constraints go down the chain and status comes back up, so each level decides only what it is best placed to decide. This is the chain for the Demon Hunter's harassment:

```text
Intention        Harass the Archmage with the Demon Hunter            rank Game plan, weight 240 gold
  Plan           hit and run: search → engage → disengage → recover
    Tactic       HitAndRun around the Archmage                        leash 800, chase at most 3 s
      Directive  Demon Hunter: Engage(Archmage), role Harasser, retreat at 45 % life, fallback at the camp
        Unit Behavior (Demon Hunter)
          reflexes       escape when trapped (Staff) · retreat when low · dodge area damage
          skills         Mana Burn · Immolation
          opportunities  last hit · finish a dying unit in range
          task           attack and reposition as directed
```

Each level uses the formalism that fits it, instead of one formalism everywhere:

| Level                   | Decides                                       | Formalism                                                                                               |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| _**Deliberation**_      | what to pursue                                | _**ranks**_ and _**weights**_ over conditions                                                           |
| _**Intention**_ runtime | which _**plan**_                              | applicable _**plans**_, preference, bounded _**failure policy**_                                        |
| _**Plan**_              | the steps of one way to pursue the goal       | an explicit, re-entrant state machine that monitors its own progress                                    |
| _**Tactic**_            | a group's fight or flight, targets, positions | persistent engagement state with hysteresis; utility pickers                                            |
| _**Unit Behavior**_     | one unit's next order                         | _**reflexes**_ preempt; then ordered _**skills**_, _**opportunities**_, _**task**_; pickers for targets |

_**Tactics**_ are reusable group controllers that _**plans**_ run: Travel, Skirmish, CreepCamp, HitAndRun, Siege, Hold, Recover. Each _**Tactic**_:

- **Keeps its group's fight-or-flight state across updates.** Engaging and disengaging have separate thresholds, and there is a minimum time between switches.
- **Evaluates fights** with the _**combat estimate**_ plus named modifiers: near home, at a choke, caught by faster enemies, already committed ([ideas](rts-ideas.md#2-computing-the-combat-estimate)).
- **Picks targets and positions with utility pickers:**
  - a kill order: healers, casters, summons, repairing Peasants;
  - focus fire without overkill;
  - spreading out against area damage.
- **Takes local opportunities** within the _**latitude**_ its _**plan**_ gave it.
- **Reports its status upward:** ongoing, done, retreated, stalled, or failing, with a reason that says what happened, such as arrived, camp cleared, or fight won.

Travel, for example, asks navigation for a route for its group, at the speed of its slowest unit and the size of its largest. It leads the group from waypoint to waypoint with Move _**Directives**_, waits for stragglers, and asks again when danger or the map changes along the way, switching only to a clearly better route.

**How a status reaches the _plan_.** A _**Tactic**_ never calls its _**plan**_. The runtime steps it at its own pace, and each step returns plain data: its _**Directives**_, its status, and the reason. The runtime keeps each _**Tactic**_'s latest result for the _**plan run**_ that started it, and a change in the kind of status makes that run step in the same tick ([section 4.13](#413-timing)). The run reads the results and decides which units each of its _**Tactics**_ steers. When Travel reports its reinforcements done, at the rendezvous, the run moves them into the group its Siege _**Tactic**_ steers and ends the Travel _**Tactic**_. Moving units between its own _**Tactics**_ is the _**plan**_'s business alone: the units keep their owner, so _**Allocation**_ is not involved.

```ts
// What a Tactic returns from each step (sketch).
interface TacticStep {
  directives: readonly Directive[];
  status: TacticStatus; // ongoing, done, retreated, stalled, failing
  reason: string; // such as 'arrived: 3 of 3 Archers at the rendezvous'
}
```

**_Directives_.** A _**Directive**_ is what a unit's owner asks of it. Every own unit gets one from its owner's _**plan run**_: a _**Tactic**_ writes the _**Directives**_ for the units in its group, and the run writes them itself for units outside any group, such as a builder or a scout. A _**Directive**_ holds until the run replaces it; in between, the unit's _**Unit Behavior**_ turns it into an order every tick. When a unit changes owner, its old _**Directive**_ ends, and the new owner's run gives it one in the same tick.

A _**Directive**_ says:

- the _**task**_: what to do, from a closed vocabulary, such as Move, Engage, Hold, Harvest, Build, Repair, Produce, UseItem, Purchase, or PickUp;
- the _**role**_: how to play the _**task**_, such as Harasser, Tank, or Scout;
- the _**latitude**_: how far the unit may deviate from the _**task**_: its retreat threshold, its leash, and its opportunism, none, own, or free ([section 4.10](#410-opportunities-and-latitude));
- optionally, a station to hold while engaging and a point to fall back to.

**_Directives_ are constraints, not micromanagement.** A _**Directive**_ says what to achieve and within which limits; the _**Unit Behavior**_ chooses the orders that achieve it: which target to hit, when to cast, where to step. Because the vocabulary is closed, every _**Unit Behavior**_ understands every _**Directive**_, and _**plans**_ and _**Tactics**_ can be tested by what they ask, not by Warcraft orders.

```ts
// A Directive (sketch).
interface Directive {
  unit: UnitId;
  task: Task; // Move, Engage, Hold, Harvest, Build, Repair, Produce, UseItem, Purchase, PickUp…
  role?: Role; // how to play it: Harasser, Tank, Damage, Support, Scout, Bait
  latitude: Latitude; // retreat threshold, leash, opportunism: none, own, or free
  station?: Point; // where to stand while engaging
  fallback?: Point; // where to retreat to
}
```

**_Unit Behaviors_.** Every own unit, buildings included, has one _**Unit Behavior**_, chosen by its unit type and owned by the _**mind**_. Each tick it:

1. **Runs its _reflexes_ first:**
   - survive;
   - escape when trapped;
   - dodge area damage;
   - cancel a construction about to be destroyed;
   - eat a tree.

   A _**reflex**_ may override the _**Directive**_ to keep the unit alive. The owner of the unit does not change.

2. **Then tries ordered modules:**
   - _**skills**_: abilities and items, used as the _**role**_ suggests;
   - _**opportunities**_, within the _**latitude**_;
   - the _**task**_, with the technique of its unit type, such as kiting or attack timing.

Each module returns a verdict with its reason. _**Roles**_, not unit types, select the policy: the Demon Hunter burns the enemy hero's mana as a Harasser and the casters' mana as Damage. Different strategies play the same hero differently through the _**roles**_ their _**plans**_ assign and their _**playbooks**_' skill and item builds. Per-unit memory, such as kiting state or the last target, lives with the _**Unit Behavior**_ and survives changes of owner.

```ts
// A Unit Behavior composed from shared modules (sketch).
const demonHunter = unitBehavior({
  reflexes: [escapeWhenTrapped, retreatWhenLow, dodgeAreaDamage],
  skills: [manaBurn, immolation, metamorphosis],
  opportunities: [lastHit, finishDyingInRange, pickUpItem],
});
```

**The _hierarchy contract_:**

- **Orders go down** as constraints from a closed vocabulary.
- **Feedback goes up** only as status (completion, stall, imminent failure) and through _**Beliefs**_ (threats seen).
- **Units may deviate to survive.**

### 4.10 Opportunities and latitude

| Level     | Examples                                                                                                    | Decided by                              | Bounded by                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| Unit      | last hit (2.16), finish a dying unit in range (2.15), pick up a dropped item, Mana Burn a passing caster    | _**Unit Behavior**_ _**opportunities**_ | the _**Directive**_'s _**latitude**_                                          |
| Group     | finish a camp the Humans left wounded (2.21), kill exposed workers on the way, chase a fleeing hero briefly | the _**Tactic**_                        | the leash, time, and risk its _**plan**_ gave it                              |
| Intention | switch the harassment to a worker line, take a mercenary camp on the route (4.17)                           | the _**Intention**_'s _**plan**_        | the _**Intention**_'s goal                                                    |
| Agenda    | raid a fresh expansion (1.4, 2B.1), attack because the enemy army died (1.20, 5.18)                         | a _**Desire**_, then _**Deliberation**_ | _**rank**_ and _**weight**_ on the _**agenda**_, and the _**switching rule**_ |

**Every level weighs an opportunity the same way.** Its value, minus the detour, the risk, and the value of what it interrupts, must exceed a threshold, within the _**latitude**_ given. Values come from _**Knowledge**_: unit worth, experience, item worth.

A _**latitude**_ has three parts: a retreat threshold, a leash, and an opportunism. A decisive fight, for example, lets cheap units fight to the end, while heroes keep a high retreat threshold.

**Who may take a chance.** A unit may take a chance on its own when no one else in its group could take the same chance, and taking it does not pull the unit away from what its group is doing. Otherwise its _**Tactic**_ decides, because only the _**Tactic**_ sees all the units involved. Whoever writes a unit's _**Directive**_ says how much the unit may take on its own, as the opportunism in its _**latitude**_:

| Opportunism | The unit may take                                                                    | Typical case                                                                           |
| ----------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| none        | nothing beyond its _**reflexes**_                                                    | the Wisp walking to the Tavern; units waiting for an ambush signal                     |
| own         | only chances no one else could take: an item at its feet, a potion, a buff on itself | units fighting together under one _**Tactic**_                                         |
| free        | any chance worth its detour, targets included, within its leash                      | a scout, which may chase a lone Peasant; the harassing Demon Hunter; a unit on its own |

_**Reflexes**_ run whatever the _**latitude**_. A _**Tactic**_ changes the _**latitude**_ as its fight changes: own during a decisive engagement, and free once the fight is won, so that units pick off stragglers on their own; a little overkill then costs less than waiting.

**One chance, one taker.** A chance that several units of a group could take is their _**Tactic**_'s call. When a weak enemy appears in range of ten Dryads, their _**Tactic**_ steps at once, because enemies appeared near its group. It gives the target to one Dryad that is ready to fire, with only the damage the target needs, measured with the damage function in _**Knowledge**_; the other nine keep their targets. The same holds for spells: several casters should not spend their mana on one target. Units of different groups that see the same chance skip a target that own units already attack with enough damage, as _**Beliefs**_ show from those units' current orders.

**Nothing reports opportunities upward.** Whatever any unit sees enters the _**Beliefs**_, and _**concerns**_ and the _**playbook**_, reading _**Beliefs**_ and _**Assessments**_, turn what matters into _**Desires**_. _**Intentions**_ only request what is specific to them, such as help or an item.

### 4.11 Strategy, playbooks, and production

**Choosing a strategy.**

- The _**strategy concern**_ proposes executing the _**playbook**_ it prefers for the matchup and the recognized enemy strategy. It switches _**playbooks**_ when no _**adaptation**_ of the current one answers the enemy well enough.
- There is one strategy at a time, because the _**strategy concern**_ proposes only the _**playbook**_ it prefers.
- Switching needs a clearly better score and a minimum time on the current _**playbook**_: AMAI requires 1.05× and a minimum strategy time.

**From strategy to _Desires_.** The _**strategy concern**_'s _**Desire**_, `ExecuteStrategy{playbook}`, is adopted like any other: the resulting _**Intention**_ is the committed strategy. It keeps the _**playbook**_'s current phase, and the _**playbook**_'s rules propose the _**Desires**_ that carry the strategy out, such as `TrainHero{Demon Hunter}` or `Attack`. Those compete on the _**agenda**_ with every other _**Desire**_, so a threat at home still outranks the game plan. Fast Bears and the Human tower rush are each one _**playbook**_.

**A _playbook_ is typed data plus small functions:**

- phases with entry conditions;
- an _**opening book**_: the exact first steps of the game, in order, such as five Wisps, an Altar of Elders, and scouting the enemy start;
- production goals as desired totals with _**ranks**_ and _**weights**_, and gates: upkeep, tier pacing;
- _**desire**_ rules per phase;
- _**expectations**_ about the enemy, and _**adaptations**_ keyed by enemy strategies;
- hero skill and item builds;
- style knobs, such as aggression, risk tolerance, and persistence, possibly drawn per game ([ideas](rts-ideas.md#4-a-personality-per-game)).

**The _opening book_** is followed step by step by the ExecuteOpening _**Intention**_. Most steps build, train, or research; commands, such as scouting the enemy start, propose _**Desires**_ like the rest of the _**playbook**_. How the steps are written down, for example as short lines of text in the way Steamhammer writes its openings, is an open choice ([ideas](rts-ideas.md#3-an-opening-language)).

**Production after the opening** belongs to ordinary _**Intentions**_: ProduceArmy, ReachTech, MaintainSupply, HireHero, ReviveHero, AcquireItem, Expand. Their _**plans**_:

- resolve prerequisites from _**Knowledge**_ before committing;
- count what exists and what is in production toward desired totals, so recomputed _**Desires**_ never double-build;
- detect jams: no progress within a minute is recorded with a reason, and the _**plan**_ changes its steps;
- make emergency reactions idempotent.

**The Fast Bears _playbook_ for Night Elf versus Human.** A phase adds to the _**Desires**_ of earlier phases and may change their _**weights**_; a goal already reached is no longer proposed.

| Phase       | Entered when                                          | Desires it proposes                                                                                                                                                                                     |
| ----------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening     | the game starts                                       | the _**opening book**_; `TrainHero{Demon Hunter}`; `ProduceArmy{5 Archers}`; `Scout{enemy start, then hero and tech}`; `Creep{Demon Hunter with the Ancient of War, until level 2}`                     |
| Harass      | the Demon Hunter reaches level 2                      | `AcquireItem{Demon Hunter, Staff}`, `HarassEnemyHero{main hero}`, and `Creep{Demon Hunter}`, in falling _**weight**_; `ReachTech{Tier 2}`                                                               |
| Second hero | Tier 2 is being researched                            | `HireHero{slot 2: Naga or Brewmaster}`; `Creep{second hero, Archers, Ancient of War, until about level 2.5}`                                                                                            |
| Reunite     | the second hero reaches about level 2 to 2.5          | `Creep{both heroes and the army, toward level 3}`; `ReachTech{Master Training}`; `ProduceArmy{Druids of the Claw}`; the harassment at a lower _**weight**_, so an engagement under way can finish (5.1) |
| Bear timing | Master Training is done and the army is strong enough | `Attack{most valuable vulnerable enemy base}`; `ProduceArmy{reinforcements}`                                                                                                                            |

_**Adaptations**_ are rules on the recognized enemy strategy, other _**Beliefs**_, and _**Assessments**_ that change _**ranks**_ and _**weights**_, and add or withdraw _**Desires**_. They scale with the recognition's confidence: a close call between two strategies is better answered by scouting the building that decides it than by countering both.

| Enemy strategy or event              | Adaptation                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Tower rush (1.1)                     | Tier 2 later, units and defensive structures earlier, no harassment                      |
| Fast expansion (1.4)                 | `RaidBase` on the expansion, ranked _**Game plan**_; consider an earlier timing          |
| Tier 2 rush, mass Footmen (1.5, 1.6) | Harassment weighted lower so the Demon Hunter stays near home; more defensive production |
| Composition observed (3.11, 3.12)    | Second-hero preference, decided when the hero is hired                                   |
| Enemy army beaten (1.20, 5.18, 6.23) | `Attack` ranked _**Game plan**_, its _**weight**_ decaying as the enemy rebuilds         |
| Flying army (6.17)                   | Anti-air composition                                                                     |

_**Expectations**_ are _**adaptations**_ that guard the _**playbook**_'s own assumptions, such as "no air units before 8:00". An absence counts only where scouting coverage says the units would have been seen. A broken _**expectation**_ runs _**Deliberation**_ early, and the _**decision record**_ names it as the reason for the change.

### 4.12 The enemy model

The _**enemy model**_ lives in _**Beliefs**_ and is fed only by _**Perception**_:

- **_Contacts_.** Every unit and structure seen, with its visibility state. Ghosts are invalidated when their position is seen empty.
- **Inferred tech.** Requirements are walked back from every type seen. A Druid of the Claw implies an Ancient of Lore and Tier 2.
- **Where unseen units probably are**, estimated from what was seen, where, and how long ago. A place seen empty holds nothing. EISBot's particles are one way to estimate it ([ideas](rts-ideas.md#1-particles-for-unseen-units)).

- **_Strategy recognition_.** The enemy's strategy is recognized against a library of known ones, kept as data: tower rush, fast expansion, Tier 2 rush, mass Footmen, and as many more as the _**playbooks**_ need answers to. Each strategy lists its signs as _**fingerprints**_: composable, timed predicates over _**contacts**_, such as "two Barracks by 3:00, no Lumber Mill". Recognition:
  - matches what was seen against every strategy in the library; an absence counts only where scouting coverage says the sign would have been seen;
  - keeps its answer stable: a new hypothesis takes over only when it clearly beats the current one;
  - runs every few seconds;
  - publishes a small result: the top one or two hypotheses, each with a confidence, since when it has held, and the signs that matched, plus what would tell them apart, for scouting to look for.

  It is a sizable subsystem with a narrow output, and it can be tested alone and measured offline against recorded games ([ideas](rts-ideas.md#6-measuring-inference-offline)). Steamhammer found even a crude recognizer a clear net win.

- **The army estimate and its projected movement.**
- **Scouting coverage:** where and when the bot has looked, which tells which absences mean something.

What the _**enemy model**_ means for the bot, such as threats to own assets and danger by region, is in _**Assessments**_ ([section 4.4](#44-assessments)).

_**Belief**_ quality can be measured offline, because a test harness knows the ground truth and the bot does not ([ideas](rts-ideas.md#6-measuring-inference-offline)).

### 4.13 Timing

**The bot shares the game's own thread.** Its Lua runs inside Warcraft on every 0.1 s tick, so whatever it does delays the game. Each kind of work therefore has a pace: it runs only as often as its answers can change, and some events make it run before its next turn.

| Work                                                  | Pace              | Runs earlier on                                                        |
| ----------------------------------------------------- | ----------------- | ---------------------------------------------------------------------- |
| _**Perception**_ and fast _**Beliefs**_               | every tick        | —                                                                      |
| _**Unit Behaviors**_                                  | every tick        | —                                                                      |
| _**Tactics**_                                         | 0.2–0.5 s         | enemies appearing near the group                                       |
| _**Intentions**_ and _**plans**_                      | 0.5–1 s           | a change in a _**Tactic**_'s status, a unit gained or lost             |
| _**Desires**_, _**Deliberation**_, _**Allocation**_   | about 1 s         | a new threat, a broken _**expectation**_, an _**Intention**_ finishing |
| Slow inference: unseen units, the army estimate       | 1–2 s             | —                                                                      |
| Enemy _**strategy recognition**_                      | every few seconds | a new enemy building type seen                                         |
| _**Assessments**_: threats, danger, relative strength | 1–2 s             | enemies seen near own assets                                           |

With 10 to 20 units in a typical army, and about 50 at most, the paces alone should keep a tick cheap. That is measured early in the game rather than assumed ([risk 4](#10-risks-and-open-questions)). Should ticks ever run long, work can be scheduled more carefully ([ideas](rts-ideas.md#5-scheduling-work-within-the-budget)); PurpleWave's frame-time overruns are the cautionary example.

### 4.14 The decision record

**Each tick, `mind.step()` returns, next to its orders, what was decided and why**, as plain data:

- the _**Assessments**_ that changed, with their inputs;
- the _**Desires**_ and their _**proposals**_ (source, _**rank**_, _**weight**_, reason);
- every _**Intention**_ adopted, paused, or finished, and why;
- the _**agenda**_;
- _**Allocation**_'s grants and denials, with the terms of the _**switching rule**_;
- each _**plan**_'s phase and transitions;
- each _**Tactic**_'s status;
- the _**Directives**_;
- each unit's chosen module and reason;
- the orders.

**The record is data, not log lines.** Tests read it straight from the returned value. And the type of each phase's result requires every decision to carry its reason, where a log call could simply be left out.

**The runtime shell writes it down.** It writes what changed since the last step through a logger of the record's own, into files apart from the game log. Both logs share the session and the game time, so they line up. Strategy, phase, _**Intentions**_ adopted or dropped, and _**Allocation**_'s grants go at info level, and each unit's choices at debug level. An invariant violation, such as a unit with two owners or a _**Directive**_ for a unit not owned, is logged as an error, with its context.

The in-game debug overlay shows the latest record as status text over units and groups, and the trace of an end-to-end test is its record's log files.

### 4.15 Why each part is needed

Each part answers a question nothing else answers:

- **The boundaries.** Without them, fair information and testability would depend on discipline.
- **Fixed phases.** Without them, bugs come from module order.
- **_Assessments_.** Without them, every reader works out again what the situation means, and two readers reach different conclusions.
- **_Desires_ separate from _Intentions_.** Otherwise every attractive opportunity becomes behavior at once, and threats and opportunities have no common place to be compared.
- **The _agenda_.** Without it, conflicts are decided by update order.
- **_Allocation_.** Without it, each _**Intention**_ picks its own units and special cases multiply.
- **_Plans_.** Without them, an _**Intention**_ has one way to succeed, and when that way fails, the _**Intention**_ fails.
- **_Tactics_.** Without them, every _**plan**_ reimplements fighting.
- **_Unit Behaviors_.** Without them, every _**Tactic**_ reimplements every unit's micro and _**reflexes**_.
- **The _decision record_.** Without it, behavior can be watched but neither explained nor asserted.

What was removed answered questions the remaining parts already answer:

| Removed              | Now answered by                                                  |
| -------------------- | ---------------------------------------------------------------- |
| Actor Control        | _**Allocation**_ and _**reflexes**_                              |
| Scoped Beliefs       | one world model plus execution state                             |
| The component tree   | plain ownership                                                  |
| Desire supports      | _**proposals**_ asked each cycle                                 |
| Capability providers | arguments and returned _**Directives**_                          |
| Intention Scheduling | the _**agenda**_ and _**Allocation**_                            |
| Command Arbitration  | each _**Unit Behavior**_, the single decision point for its unit |
| Execution roles      | _**Directives**_                                                 |

## 5. Testability

The project asks for three kinds of tests. This section describes the properties of the architecture that make them easy, not a test plan.

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

## 6. Walkthroughs

### 6.1 The Demon Hunter's harassment, interrupted twice

Scenarios 2, 2B.1, 2.14, and 2B.9.

1. **Adoption.** In its Harass phase the _**playbook**_ proposes, in falling _**weight**_, buying the Staff, `HarassEnemyHero{Archmage}` (_**rank Game plan**_, _**weight**_ 240 gold), and creeping with the Demon Hunter. Once he holds the Staff, AcquireItem is achieved and frees him, and _**Allocation**_ gives him to the harassment, the highest _**Intention**_ that needs him.
2. **Search.** The _**plan**_ searches where the Archmage was last seen and where camps found cleared suggest his route; both come from the _**enemy model**_. The Travel _**Tactic**_ moves the Demon Hunter with local opportunism, and he creeps small camps on the way.
3. **Contact.** The HitAndRun _**Tactic**_ directs the Demon Hunter to engage the Archmage as a Harasser, retreating at 45 % life to a fallback point. His _**Unit Behavior**_ burns mana while the Archmage has enough to lose, and his escape _**reflex**_ is armed with the Staff.
4. **An expansion appears.** The scouting Wisp sees a Town Hall under construction. _**Perception**_ adds a _**contact**_, and _**strategy recognition**_ now reads the enemy strategy as a fast expansion. The _**playbook**_ adapts and proposes `RaidBase{north expansion}`, _**rank Game plan**_, _**weight**_ 340 gold.
5. **Preemption.** _**Deliberation**_ adopts the raid. Both _**Intentions**_ have _**rank Game plan**_, so the _**switching rule**_ applies. The raid's 340 gold exceeds the harassment's 240 plus its _**switching margin**_: the _**commitment constant**_, 20, plus the _**interruption cost**_ of the engagement under way, 40; 300 in total. _**Allocation**_ moves the Demon Hunter, and the harassment is _**starved**_: it keeps its state but has no force.
6. **The raid.** The raid's Siege _**Tactic**_ puts the building Peasant first in its kill order, and the Demon Hunter kills it.
7. **A threat at home.** Five Footmen reach the Night Elf Wisps.
   - The Wisps flee by _**reflex**_ at once; their owner does not change.
   - The _**threat assessment**_ weighs the five Footmen against the two Archers and the Ancient of War at home, and rates the threat serious. The _**base-safety concern**_ proposes `DefendBase{main}` with _**rank Emergency**_, and the urgent event runs _**Deliberation**_ on the next tick.
   - DefendBase needs strength above the threat, arriving within 20 seconds. _**Allocation**_ fills the _**need**_ nearest first. The two Archers and the Ancient of War at home are not enough against five Footmen, so it also takes the Demon Hunter, whose Staff lets him arrive in time. The defense outranks the raid, so no margin is needed.
   - Against a lone Footman, the Archers and the Ancient of War would meet the _**need**_, and the Demon Hunter would stay on the raid. With nobody at home, the _**threat assessment**_ would rate a lone Footman small, so it would be ranked _**Game plan**_, and its _**weight**_, a Wisp or two, would not beat the raid's _**switching margin**_: the Wisps would flee, and the raid would go on.
8. **The defense.** The defense's _**plan**_ directs him to use the Staff, and the Hold _**Tactic**_ fights by the Moon Wells, focusing the Footmen.
9. **Resumption.** With the Footmen dead, the _**threat assessment**_ clears the threat, and the _**base-safety concern**_ stops proposing; DefendBase is achieved. The Peasants have evacuated, so the raid's target is gone and it fails with that reason. Before the harassment is stepped again, it is re-checked: the _**playbook**_ still proposes it and the Archmage is alive, so it gets the Demon Hunter back. Its _**plan**_ re-enters from _**Beliefs**_ (where the Archmage was last known to be) rather than replaying from where it stopped.

No _**Intention**_ told another anything. Every switch came from _**Beliefs**_, _**Desires**_, the _**agenda**_, and _**Allocation**_, and the _**decision record**_ holds the reason for each.

### 6.2 Buying the second hero

Scenario 3.

1. **The _Desire_.** When Tier 2 research starts, the _**playbook**_ enters its Second hero phase and proposes `HireHero{slot 2}`, _**rank Game plan**_, with Naga and the Brewmaster as candidates.
2. **Timing the Wisp.** HireHero's _**plan**_ needs nothing until the predicted Tier 2 completion minus the Wisp's travel time and a margin (3.1, 3.2). The prediction comes from _**Knowledge**_ (research time) and _**Beliefs**_ (when the research started); the travel time comes from navigation. Then the _**plan**_ needs one Wisp, which _**Allocation**_ takes from RunEconomy.
3. **Saving.** Slightly before completion the _**plan**_ also needs the hero's gold and food. Cheaper spending stops in time (3.7), and MaintainSupply builds for the reserved food (3.9).
4. **Travel.** The Wisp travels a safe route with no opportunism.
   - If it dies, the _**need**_ is unmet again and _**Allocation**_ sends another (3.3).
   - At the Tavern, the _**plan**_ waits at a safe distance while enemies are near (3.4).
5. **Choosing the hero.** At hire time, the _**playbook**_'s rule chooses against the latest estimate of the enemy composition (3.11, 3.12). If the Tavern's stock shows the preferred hero is gone, it falls back to the other candidate (3.5, 3.6).
6. **The new hero.** _**Allocation**_ gives the new hero to the highest _**Intention**_ asking for heroes: Creep normally, DefendBase if the base is attacked (3.13), a raid if an expansion lies exposed (3.16).

### 6.3 A creep fight interrupted by the Human army

Scenario 4.8.

1. **The fight.** Creep's _**plan**_ engages a camp with the CreepCamp _**Tactic**_:
   - the Ancient of War in front, as a Tank;
   - Archers behind;
   - Naga slowing enemies with Frost Arrows;
   - the camp's healer first in the kill order.
2. **The Humans arrive.** The Archmage, Footmen, and a Water Elemental appear. The _**Tactic**_ re-evaluates the fight with both sides and the remaining creeps. Its engagement state crosses the disengage threshold: the fight is lost unless the last creep dies within seconds.
3. **Splitting up.** It sends two Archers, with local _**latitude**_, to finish the creep. Everyone else retreats along a route away from the Humans, Naga first, past the spot where the item will drop.
4. **Micro.**
   - The Archers kite the chasing Footmen. Since Defend weakens their piercing attacks, the Archers' target picker prefers the Water Elemental.
   - Naga's Frost Arrows slow the pursuers.
   - Naga's _**reflex**_ steps behind the Ancient when she is focused, and she picks up the dropped item as an opportunity within her retreat's leash.
5. **Afterwards.** The _**Tactic**_ reports that it retreated. The _**plan**_ marks the camp contested and picks one away from the Human army.

## 7. Where a new behavior goes

A behavior goes at the lowest level that has the information and the authority it needs.

| Behavior to add                                                                               | Home                                                                                                        |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Use of an ability or item by a unit type, such as Naga's Mana Shield when focused             | that type's _**Unit Behavior**_ _**skills**_                                                                |
| Survival and safety of a unit, such as worker flight or hero escape                           | _**Unit Behavior**_ _**reflexes**_                                                                          |
| A small gain one unit can take alone, such as a last hit                                      | _**Unit Behavior**_ _**opportunities**_                                                                     |
| Coordination of a group in a fight: focus fire, spreading, kill order                         | a _**Tactic**_'s pickers and engagement rules                                                               |
| A local gain a group can take within its purpose, such as finishing a wounded camp            | _**Tactic**_ opportunities                                                                                  |
| Another way of pursuing an _**Intention**_                                                    | a new _**plan**_ of the _**Intention kind**_                                                                |
| A step or choice inside one way                                                               | that _**plan**_'s state machine                                                                             |
| A new kind of outcome to pursue, such as an escort or a drop                                  | a new outcome kind and _**Intention kind**_                                                                 |
| Something any competent player wants in some situation                                        | a _**concern**_                                                                                             |
| Something this game plan wants, or an _**adaptation**_ to the enemy                           | the _**playbook**_                                                                                          |
| What should win a conflict                                                                    | a _**rank**_ or _**weight**_ consideration, or a _**pause condition**_                                      |
| What a situation means for the bot, needed by several parts, such as a threat to an expansion | an _**Assessment**_                                                                                         |
| A new enemy strategy to recognize, such as a proxy                                            | an entry in the _**strategy library**_                                                                      |
| A new fact or inference about the game, such as the enemy's tech                              | a _**belief model**_ or inference rule                                                                      |
| How the game works: damage, timings, requirements                                             | _**Knowledge**_ data or a _**Knowledge**_ function                                                          |
| How to get somewhere: route danger, unit size                                                 | navigation, over the map in _**Knowledge**_ and _**Beliefs**_, with danger from the _**danger assessment**_ |

## 8. Changes to the current code

| Current concept                                                                   | Second iteration                                                                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Common Beliefs model and belief container                                         | one world model in sections, plain data, unit ids                                                            |
| Warcraft reads inside belief models; orders inside components                     | _**Perception**_ and the _**order executor**_ only                                                           |
| Scoped Beliefs, a BeliefsModel per component, registration in the beliefs runtime | dropped: shared facts are _**Beliefs**_, the rest is execution state                                         |
| Per-component Common Beliefs declarations with generic assemble functions         | dropped: components import the _**Beliefs**_ type                                                            |
| Assemble functions, AssembledComponent, child factories, the component tree       | dropped: owners construct their parts directly                                                               |
| Capability providers acting for the running update                                | dropped: _**Intentions**_ receive their force as an argument and return _**Directives**_                     |
| Desire supports with ids, refresh, and staleness                                  | _**proposals**_ asked for each cycle                                                                         |
| Permanent Desires                                                                 | _**concerns**_ (maintenance goals)                                                                           |
| Option Generation                                                                 | kept: collects and merges _**proposals**_                                                                    |
| Deliberation (a fixed policy)                                                     | conditions, an adoption registry, a ranked _**agenda**_, reasons                                             |
| Intention (`update`, `assessCommitment`)                                          | _**Intention kinds**_ (conditions, _**plans**_, _**requests**_, _**failure policy**_) on one generic runtime |
| Plan, Controller                                                                  | _**plans**_ and _**Tactics**_ (group Controllers)                                                            |
| Actor Control                                                                     | _**Allocation**_ and _**Unit Behavior**_ _**reflexes**_                                                      |
| `UpdateInterval`                                                                  | cadences of the tick phases                                                                                  |
| Assessments (private `*.assessments.ts`)                                          | shared interpretations become _**Assessments**_; private ones stay in their modules as _**judgments**_       |
| `debug` messages                                                                  | the _**decision record**_, in log files of its own, and the game log                                         |

Mapping the current behaviors:

- **Worker safety** becomes the worker _**reflex**_.
- **Tower target selection** becomes the Guard Tower's _**Unit Behavior**_.
- **AdaptStrategy** becomes the _**strategy concern**_.
- **The tower rush** becomes a Human _**playbook**_, with an _**Intention kind**_ that establishes the tower position. Its _**plan**_ needs the forward Peasants and repairs the towers. RunEconomy runs the home economy.

`@lib/bdi` shrinks to what is generic and still needed:

- the _**Desire**_ and _**proposal**_ types;
- the _**agenda**_ and _**Allocation**_ algorithms over abstract assets;
- the _**Intention kind**_ runtime.

## 9. Roadmap

Each step leaves a working bot and updates the architecture documents.

1. **The _mind_ shell.**
   - _**Perception**_ with unit ids, the _**order executor**_, `createMind` and its tick phases, and a first _**decision record**_.
   - Existing Warcraft reads and orders move behind the boundaries, with no behavior change.
2. **One world model.**
   - _**Beliefs**_ in sections, with enemy _**contacts**_ and neutral camps, and the first _**Assessment**_: threats to own assets.
   - Drop Scoped Beliefs, the beliefs runtime's registration, and the component tree.
3. **_Desires_, _Deliberation_, _Intention kinds_.**
   - _**Proposals**_, _**ranks**_ and _**weights**_, conditions, the _**agenda**_, and the generic _**Intention**_ runtime.
   - Port the current behaviors: AdaptStrategy becomes the _**strategy concern**_; the tower rush becomes a _**playbook**_ and its _**Intention kind**_.
4. **_Allocation_.**
   - Units first, then money with projected income.
   - Remove Actor Control.
5. **_Unit Behaviors_ and _Directives_.**
   - Worker safety becomes the worker _**reflex**_; tower targeting becomes the Guard Tower's _**task**_.
   - Then the first _**Tactics**_ (Travel, Skirmish), the _**combat estimate**_, and navigation over the map in _**Knowledge**_ and _**Beliefs**_.
6. **Production.**
   - The opening language.
   - Production _**Intentions**_ with desired totals and jam detection.
   - Gates for tier pacing and upkeep.
7. **The _enemy model_ and scouting.**
   - _**Contacts**_ with ghosts, inferred tech, _**strategy recognition**_ with its _**strategy library**_, estimates of unseen units, and coverage.
   - The danger and relative strength _**Assessments**_.
8. **The Night Elf game plan.**
   - The Fast Bears _**playbook**_, phase by phase.
   - Each phase brings its _**Intention kinds**_, _**plans**_, _**Tactics**_, and _**Unit Behaviors**_, with the scenarios as acceptance cases.

## 10. Risks and open questions

1. **Calibration.** The _**agenda**_ is only as good as the _**ranks**_ and _**weights**_ feeding it. No formula picks good values, but tuning can be made safe:
   - _**Ranks**_ keep fixed meanings, so the hardest comparisons, such as a lethal threat against creeping, never come down to numbers.
   - _**Weights**_ are values in gold, computed from game facts, so whether one is right can be argued and checked ([section 4.5](#45-desires)). What stays hand-set is a handful of named knobs, such as how much a hero level is worth, how far ahead to look, and how much risk to accept: the _**playbook**_'s style knobs.
   - _**Proposals**_ come from few places, the _**concerns**_ and the _**playbooks**_, and _**interruption costs**_ are named losses valued in one place.
   - Each scenario becomes a test of the decision it should produce, such as a fresh expansion's raid beating an ongoing harassment, or a lone Footman not recalling the hero. Changing a value function or a knob reruns them all, so tuning cannot silently break earlier decisions.
   - When a game goes wrong, the _**decision record**_ shows which term was misjudged, so that estimate is fixed rather than the final number.
2. **The _combat estimate_.** Fight or flight at every level depends on it.
   - Start with a cheap strength estimate (AMAI's and PurpleWave's) plus named modifiers ([ideas](rts-ideas.md#2-computing-the-combat-estimate)).
   - Calibrate it with in-game probes, and add simulation only where decisions go wrong.
3. **_Strategy recognition_.** Under fog, recognition is often ambiguous, and a wrong call becomes a wrong _**adaptation**_. _**Adaptations**_ scale with the recognition's confidence, scouting resolves close calls, and accuracy can be measured offline against recorded games ([ideas](rts-ideas.md#6-measuring-inference-offline)).
4. **Cost in Lua.** A _**Unit Behavior**_ for every own unit every tick, plus inference, must run fast enough inside the game's thread. Measure early in the game; if ticks run long, schedule the work more carefully ([ideas](rts-ideas.md#5-scheduling-work-within-the-budget)).
5. **Game data.**
   - Liquipedia answers the research environment only through web.archive.org, page by page. Extract game data from the game's own files and version it by client build.
   - The source catalogue gives the current patch as 3.0.1 (build 24342).
6. **Map data.** Map knowledge comes from the build-map tooling, and its format still needs a contract. The map also changes during a game, and keeping the map in _**Beliefs**_ current must stay cheap enough in Lua.
7. **Order semantics.**
   - Scripts cannot queue orders, and re-issued attacks restart.
   - Ability and item orders need verifying in the game, skill by skill.
   - An order native's result is not always reliable: a build order reports failure even when the unit accepts it, so a refusal must be confirmed from what the unit does next.
8. **What _Perception_ can read.** Some _**Beliefs**_ the scenarios rely on may not be readable through natives, or not fairly; shop and Tavern stock above all. Each needs an in-game probe. A fact that cannot be read must be inferred, for example stock from a failed purchase.
9. **Automating end-to-end tests.** Launching Warcraft III into a test map, at speed and with a fixed seed, is unverified.
10. **Persistence across games.** Whether a map script can keep an opponent model between games is unknown. Without it, the opponent model lasts one game.
11. **The generic _Intention_ runtime must stay small.**
    - It earns its place only by removing duplication from _**Intention kinds**_.
    - Anything that cannot be explained in a paragraph belongs to a kind, not to the runtime.
