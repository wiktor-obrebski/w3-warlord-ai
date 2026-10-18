# Research: Architecture for Full RTS Gameplay

Status: research proposal for discussion, second iteration (18 October 2026). It is not the adopted architecture; that remains [`ARCHITECTURE.md`](../ARCHITECTURE.md), summarized together with the current implementation in [`ARCHITECTURE_SITEMAP.md`](../ARCHITECTURE_SITEMAP.md). The first iteration is in the Git history of this file.

Companions:

- [`rts-architecture-introduction.md`](rts-architecture-introduction.md): a tutorial introduction; start there if the architecture is new to you.
- [`rts-scenario-analysis.md`](rts-scenario-analysis.md): the Night Elf versus Human scenarios, the requirements they imply, and how every deviation is handled.
- [`rts-research-sources.md`](rts-research-sources.md): the sources read and what each one contributed or warned against.

## 1. Summary

The first iteration proposed Intentions that declare what they need, served in one priority order, and a chain of execution down to every unit. The second iteration researched:

- strong RTS bots: PurpleWave, Steamhammer and UAlbertaBot, EISBot;
- AMAI, the main existing Warcraft III melee AI;
- the Jadex and Jason BDI frameworks, and BDI research on goal lifecycles and testability;
- professional game AI practice.

That research confirmed the core of the first iteration and changed most of what surrounds it. The main decisions:

1. **One deterministic mind behind two plain-data boundaries.** Perception turns Warcraft into observations, and the order executor turns orders into Warcraft calls. Everything between them is TypeScript over plain data:
   - units are identified by ids, not handles;
   - game time comes in with the observations;
   - one seeded random source is passed in;
   - static knowledge is supplied when the mind is created.

   This one boundary serves three purposes: fair information, testing, and explaining decisions.

2. **Fixed phases per tick, and a decision record.** Each tick observes, revises Beliefs, deliberates and allocates on cadence, steps Intentions, decides per unit, and executes. No phase depends on another being updated first. Every phase records why it decided what it did.
3. **Interpretation has explicit homes.** Beliefs hold what was seen and what is probably true. Assessments hold what it means for the bot, shared by every part that needs it, such as the threat to a base. An interpretation only one module needs stays private in that module, and how the game works is Knowledge.
4. **Desires are asked for, not pushed.** Each deliberation cycle collects proposals from three sources: concerns (maintenance goals, in BDI terms), the committed strategy's playbook, and the active Intentions' requests. There are no support ids, refresh intervals, or staleness.
5. **Deliberation ranks, and commitment is explicit.** A Desire has a rank (a category) and a weight (its value within that category):
   - context conditions over Beliefs settle logical conflicts;
   - Allocation settles competition for resources;
   - a switching rule makes preemption deliberate: within a rank, a challenger must beat the incumbent by a margin. The margin is a commitment constant plus what interrupting the incumbent would waste.
6. **Intentions are goals with methods.** An Intention kind declares its conditions, its methods (its Plans), its requests, and how it handles failure. One small generic runtime chooses methods, handles failure in a bounded, named way, and keeps every state change with its reason.
7. **Allocation is the only owner of units and money.** Needs are served in agenda order and renewed every cycle. Money is reserved against stock plus projected income. Workers, scouts, and builders are not special cases.
8. **Execution keeps the first iteration's chain, with a fitting formalism at each level.**
   - Methods are re-entrant state machines.
   - Tactics keep a group's fight-or-flight state with hysteresis.
   - Unit Behaviors let reflexes preempt ordered skills, opportunities, and the task.
   - Directives are constraints, not micromanagement, and units may deviate from them to survive.
9. **The infrastructure shrinks.** These are dropped:
   - Scoped Beliefs and their runtime;
   - assemble functions and child factories;
   - per-component Common Beliefs declarations;
   - desire supports;
   - capability providers that act for the running update;
   - Actor Control.

   Components become plain objects owned by their parents, and Beliefs become one world model.

The bot answers five questions, each in one place:

| Question                                                                             | Answered by                                                          |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **Know**: what is true, was seen, or is probably true, and what does it mean for us? | Beliefs (memory and inference), Assessments, and static Knowledge    |
| **Want**: what would be worth achieving now?                                         | Desires proposed by concerns, the playbook, and Intentions' requests |
| **Commit**: what do we pursue, and in which order?                                   | Deliberation: Intentions and the agenda                              |
| **Allocate**: who gets which units, gold, lumber, and food?                          | Allocation: needs served in agenda order                             |
| **Act**: how is each commitment carried out, unit by unit?                           | Intention → method → Tactic → Directive → Unit Behavior → order      |

## 2. Requirements

The brief fixes one point: Beliefs, Desires, and Intentions keep their purpose and meaning. Beliefs are what the bot holds true, Desires what it would find worth achieving, and Intentions what it has committed to and how it pursues them. Every other concept of the current architecture was free to change. The design must be as simple as possible, but not simpler.

The [scenario analysis](rts-scenario-analysis.md#2-requirements-from-the-scenarios) derives R1–R13 from the scenarios; the project adds R14–R18.

| Requirement                                                                                                                                                  | Met by                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| R1: Commitment with replaceable methods                                                                                                                      | Intention kinds with several methods, which the generic runtime chooses and replaces (4.7)                                                |
| R2: Interruption without loss                                                                                                                                | Starved and paused Intentions keep their state; method runs are re-entrant; the switching rule weighs named interruption costs (4.7, 4.8) |
| R3: One priority order for contested assets                                                                                                                  | The agenda, and Allocation of units and money in its order (4.6, 4.8)                                                                     |
| R4: Situations create Desires                                                                                                                                | Concerns and playbook rules over Beliefs and Assessments, asked every cycle (4.4, 4.5)                                                    |
| R5: Bounded opportunism                                                                                                                                      | Latitude in Directives, opportunity windows, and one value test at every level (4.9, 4.10)                                                |
| R6: Reflexes faster than deliberation                                                                                                                        | Unit Behavior reflexes every tick, whoever owns the unit (4.9, 4.13)                                                                      |
| R7: Group combat as a skill                                                                                                                                  | Tactics: persistent fight-or-flight state, the combat estimate with named modifiers, pickers (4.9)                                        |
| R8: Unit- and hero-specific play                                                                                                                             | A Unit Behavior per unit type, roles in Directives, hero builds in playbooks (4.9, 4.11)                                                  |
| R9: Knowledge under uncertainty                                                                                                                              | Contacts with age and provenance; inferences with confidence: particles, plan recognition, coverage (4.3, 4.12)                           |
| R10: Space and time                                                                                                                                          | Map knowledge, navigation, the danger assessment, travel time, projections, opportunity windows (4.3–4.5)                                 |
| R11: Consistent mechanics                                                                                                                                    | One set of Knowledge data and functions, and shared Assessments (4.3, 4.4)                                                                |
| R12: Strategy as an adaptable game plan                                                                                                                      | Playbooks: phases, an opening book, production goals, adaptations (4.11)                                                                  |
| R13: Explainability                                                                                                                                          | A reason with every decision and every assessment, kept in the decision record (4.4, 4.14)                                                |
| R14: Testability. Scenarios are easy to set up; wide behavioral tests cover everything except the Warcraft III integration; end-to-end tests run in the game | Two plain-data boundaries, injected inputs, one root per game, the decision record (4.1, 5)                                               |
| R15: Bounded work. Lua inside the game's own thread, up to about a hundred own units, a 0.1 s tick                                                           | Cadences, budgets, and work counters (4.13)                                                                                               |
| R16: Maintainability. Every decision has one home, game plans read as data, no framework grows beyond a demonstrated need                                    | One home per behavior (7), playbooks as data, a small generic runtime (4.7, 4.11)                                                         |
| R17: Fair information. Reasoning sees only what a player could see                                                                                           | Perception, the only reader of Warcraft, filters by visibility; Beliefs hold contacts, not enemy units (4.1, 4.3)                         |
| R18: Static knowledge prepared offline. Everything deducible from the map and game files comes from build-time tooling                                       | Knowledge supplied when the mind is created, read through pure functions (4.3)                                                            |

## 3. Principles

1. **One mind, two boundaries.** Only Perception reads Warcraft, and only the order executor writes to it. Everything between them is plain TypeScript over plain data. That single boundary enforces fair information, makes testing possible, and makes decisions explainable.
2. **One home per decision.** Knowing, wanting, committing, allocating, and acting at each level are each answered in exactly one place.
3. **Phases, not module order.** Each tick runs fixed phases. A phase reads only Beliefs and what earlier phases produced.
4. **Explicit and explained.** Priorities form an explicit agenda, ownership is an explicit allocation, and every decision records its reason.
5. **Deliberate commitment.** Every switch has explicit inertia: of strategy, method, target, fight or flight, or a unit's owner.
6. **Bounded failure handling.** Few alternatives, named recovery, limited attempts, and no generic retry. Failure handling is what makes a BDI program's behavior space explode.
7. **Data where data suffices.** Game plans, openings, production goals, and unit data are typed data; judgments are small pure functions.
8. **Bounded work.** Every layer has a cadence and a budget, and its work is counted.

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

- **Perception** is the only code reading Warcraft state for decisions. It produces observations:
  - own units;
  - visible enemy and neutral units;
  - items on the ground;
  - game time;
  - what happened this tick: attacks on own units, deaths, spells cast by visible units, constructions started, and the outcome of last tick's orders.

  It filters by visibility, which is where fair information is enforced.

- **Unit ids.** The mind never holds Warcraft handles. Perception gives each unit an id for its lifetime and keeps the map from ids to handles. Orders name units by id, and the executor maps them back.
- **The order executor** is the only code issuing Warcraft orders.
  - It skips an order equal to what the unit is already doing, because a re-issued attack restarts it.
  - It records each order's reason.
  - Rejected orders return to the mind as observations.
- **Inputs are injected.**
  - Game time arrives with the observations.
  - One seeded random source is passed in.
  - Static Knowledge (game data and map knowledge) is supplied when the mind is created.

  Nothing in the mind reads a clock, a random generator, or a data file by itself.

- **One root per game.** The mind is created for one game and holds all its state in its closure; there is no module-level state. A fresh mind is a fresh game.

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
  diagnostics.keep({ record });
});
```

### 4.2 A tick, phase by phase

| Phase                             | Runs                                                           | Reads                                                          | Produces                                                  |
| --------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| 1. Revise Beliefs and Assessments | every tick                                                     | observations, previous Beliefs and Assessments                 | Beliefs, then Assessments                                 |
| 2. Collect Desires                | each deliberation cycle (about 1 s), or early on urgent events | Beliefs, Assessments, active Intentions                        | Desires with their proposals                              |
| 3. Deliberate                     | with phase 2                                                   | Beliefs, Assessments, Desires, Intentions                      | Intentions adopted, kept, paused, or finished; the agenda |
| 4. Allocate                       | with phase 2, and when units appear or die                     | Beliefs, the agenda, needs                                     | each Intention's force and budget                         |
| 5. Step Intentions                | each Intention at its cadence, in agenda order                 | Beliefs, Assessments, its force and budget                     | Directives                                                |
| 6. Decide per unit                | every tick, within a budget                                    | Beliefs, Assessments, each unit's Directive, the unit's memory | orders                                                    |
| 7. Record                         | every tick                                                     | everything decided                                             | the decision record                                       |

**No phase depends on another being updated first.** No phase calls into a later one, and no component relies on another having run before it. That removes the "must run before X" ordering that kept producing bugs in Steamhammer.

**Some events run phases 2–4 on the next tick** instead of waiting for the next cycle: a threat appearing, a broken expectation, an Intention finishing, a unit lost.

### 4.3 Beliefs and Knowledge

**Beliefs are one world model, as plain data.** Belief models revise it, each one a pure function that owns a section: it takes the previous section and the observations, and returns the next section. To everything else, Beliefs are read-only.

| Section            | Contents                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Self               | Own units: type, position, life, mana, cooldowns, current order, items. Heroes: level, experience, skills. Buildings and their queues, upgrades, gold, lumber, food and upkeep, Moon Well mana.                                                                                                                                                                              |
| Enemy contacts     | Every enemy unit and structure seen, with: last known position; life and mana while visible; time since seen; how it is known (seen or inferred); visibility (visible, recently seen, missing, gone); confidence. Heroes with level and items seen. Bases.                                                                                                                   |
| Enemy inferences   | Tech inferred from requirements; unseen units as particles; army estimate and projected movement; hero whereabouts; the recognized enemy plan; scouting coverage.                                                                                                                                                                                                            |
| Neutral            | Creep camps (alive, wounded, cleared, last seen); items on the ground; shop and Tavern stock when seen.                                                                                                                                                                                                                                                                      |
| Time               | Game time; day or night.                                                                                                                                                                                                                                                                                                                                                     |
| Events             | What happened this tick: attacks on own units, deaths seen, spells seen, order outcomes.                                                                                                                                                                                                                                                                                     |
| Knowledge (static) | **Game data:** units, heroes, abilities, items, upgrades, requirements, costs, build times, damage and armor tables, experience rules. **Map knowledge:** regions and chokes as a graph for high-level routing, pathing by unit size, start locations, bases and their gold mines, creep camps with their creeps and item drops, shops, Taverns, Mercenary Camps, fountains. |

- **Contacts, not actors.** Enemy beliefs record what the bot saw and inferred, never the enemy units themselves. A remembered "ghost" becomes invalid when its position is seen empty.
- **Uncertainty stays uncertainty.** Inferred beliefs carry confidence and age.
- **Projections enable prevention.** Proactive maintenance needs beliefs about the near future: the food queued production will use, when a threatening army will arrive, when research completes. Concerns act on these before a condition breaks; in an RTS, reacting after it breaks is too late.
- **Derived facts are filtered once.** Facts that drive decisions, such as an enemy army being near, get their hysteresis where they are inferred, not in every consumer.
- **Knowledge is supplied when the mind is created.** Tests can then give it a two-region map and a handful of unit types.
  - Knowledge functions are pure and are imported where needed: the combat estimate, travel time, routes with danger costs, damage, production time, requirements.
  - They take data from Beliefs as input.
- **No Scoped Beliefs.** A fact several components need is a Belief; anything else is a component's execution state.
- **Beliefs are not Assessments.** Beliefs say what is, or is probably, true. What that means for the bot belongs to Assessments ([section 4.4](#44-assessments)).

### 4.4 Assessments

Beliefs say what is, or is probably, true. **Assessments say what it means for the bot.** Five Footmen at the Wisps are a fact. Whether they are a serious threat depends on what defends the Wisps: two Archers, or a ring of Ancient Protectors. That judgment is an assessment. The distinction is the adopted architecture's: "Belief is not assessment".

| Assessment        | Says                                                                                                                                                                                                                            | Read by                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Threats           | each threat to own assets: its target; the enemy's strength, discounted by distance and using projected movement, against what defends the target; when it arrives; its severity (lethal, serious, or small); the value at risk | concerns, context conditions, worker reflexes                         |
| Danger            | how dangerous each region is, from enemy contacts, their projected movement, and towers                                                                                                                                         | navigation, Tactics, methods choosing camps and routes                |
| Relative strength | own army against the enemy's estimate, now and at the playbook's next timing                                                                                                                                                    | the playbook's phase conditions and adaptations, the strategy concern |
| Map control       | which regions and camps each side holds or contests                                                                                                                                                                             | creeping and expansion methods, the playbook                          |

**An interpretation is an assessment** when it interprets Beliefs relative to the bot (its assets, its defenses, its plan) and several parts need it and must agree on it. A defense sized by one threat estimate must not meet an economy that fled from another. Every interpretation has one home:

| Interpretation                                                                                                      | Home                                |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| What was seen                                                                                                       | Beliefs: contacts and own state     |
| What is probably true, such as the enemy's tech, plan, and army                                                     | Beliefs: inference, with confidence |
| What it means for the bot, needed by several parts                                                                  | an Assessment                       |
| What it means for one decision only, such as a Tactic's view of its own fight or a method's choice of the next camp | a private judgment in that module   |
| How the game works                                                                                                  | Knowledge                           |

Which plan the enemy follows is a claim about the world, so recognizing it is inference ([section 4.12](#412-the-enemy-model)). Whether that plan beats ours is an assessment.

**How Assessments work:**

- They are revised in phase 1, after the Beliefs they read, each at its own cadence ([section 4.13](#413-timing-and-budgets)).
- They are plain data, read-only to everything else. Like Beliefs, they never propose Desires: concerns, the playbook, and requests read them and propose.
- An assessment keeps memory where it needs it. A base counts as threatened only once a threat has persisted, and stays so until it has clearly passed. That hysteresis lives in one place, not in every reader.
- Each records its inputs, so the decision record shows the whole chain, for example: "5 Footmen seen near the Wisps 2 s ago; strength 7.5 against 4.2 at home → serious threat to the main base → `DefendBase`, Emergency".
- An assessment may be small, like threats, or a subsystem with its own structure, like danger over the whole map. Either way its output stays narrow.
- An interpretation is kept as an assessment when it needs memory or has many readers. A pure, cheap question with one reader, such as the danger along one route, stays a function called when needed.

### 4.5 Desires

A Desire is an outcome the bot considers worth pursuing. It has a canonical identity and the proposals that support it. It carries no behavior and commits to nothing.

- **Two kinds of outcome.**
  - _Achieve_ a state: `ReachTech{Tier 3}`, `AcquireItem{Demon Hunter, Staff of Teleportation}`, `ReviveHero{hero}`.
  - _Perform_ an activity: `Creep{heroes, until}`, `HarassEnemyHero{hero}`, `DefendBase{base}`, `Attack{objective}`.
- **Concerns are not Desires.** A concern is something the bot keeps caring about all game, such as "keep the bases safe" or "keep supply ahead"; BDI literature calls it a maintenance goal. A concern watches a condition, and proposes an achieve or perform Desire when the condition is violated (recovery) or predicted to be violated (prevention).

Desires come from three sources, asked every deliberation cycle:

| Source   | Owner                  | Examples                                                                                                                                                                                                           |
| -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Concerns | the bot                | `DefendBase{base}` while threatened; `ReviveHero{hero}` while dead; `Scout{enemy start}` until known; `ExecuteStrategy{playbook}` for the preferred playbook; `RunEconomy`, `MaintainSupply`, and `Reserve` always |
| Playbook | the committed strategy | `TrainHero`, `ProduceArmy{composition}`, `Creep`, `HarassEnemyHero`, `RaidBase`, `HireHero`, `ReachTech`, `Attack`                                                                                                 |
| Requests | active Intentions      | `AcquireItem{Demon Hunter, Staff}`, `ProtectUnit{Demon Hunter}`, `ClearCamp{camp at the expansion}`                                                                                                                |

**A proposal carries a rank, a weight, and a reason.**

- **Rank** is the category: Survival, Emergency, Game plan, Opportunity, or Background.
- **Weight** is the value within the rank, computed at runtime from Beliefs and Assessments. A weight of 0 vetoes the proposal.
- A Desire takes its best proposal: the highest rank, then the highest weight.
- **Each proposer picks the rank for the situation.**
  - The threat assessment rates a threat lethal, serious, or small, and the base-safety concern ranks it Survival, Emergency, or Game plan. A small threat, such as a lone Footman at the Wisps, competes by weight, so it cannot pull a hero off a more valuable commitment.
  - A raid is usually an Opportunity, but the playbook may rank pressing a beaten army as Game plan.
- **Opportunities carry a window.** A proposal for a short-lived gain states how long the chance lasts and how long pursuing it takes. A Desire that can no longer fit its window, given travel time and the units available, gets weight 0 instead of waiting for units.

**A request belongs to its Intention.** It disappears as soon as the Intention stops proposing it, or ends. Every Desire is recomputed each cycle from the current Beliefs, Assessments, and Intentions.

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

Each cycle, Deliberation:

1. **Checks conditions.** It evaluates each active Intention's conditions over Beliefs and Assessments:
   - achieved: the Intention is finished as achieved;
   - impossible: it is finished as failed, with the reason;
   - out of context: it is paused, with the reason.
2. **Adopts.** For each valid Desire without an Intention, it creates an Intention of the kind registered for the outcome's kind. A Desire's identity keeps this to one Intention per outcome: two proposals to raid the same base are one Desire, and there is one strategy because the strategy concern proposes only the playbook it prefers.
3. **Orders the agenda.**
   - Intentions are ordered by rank, then by weight: by their value only. Switching costs apply only where one Intention would take units from another ([section 4.8](#48-allocation)).
   - An Intention is relative to the reason it was adopted for. Once its Desire is gone, it is dropped, unless its run is in a step marked uninterruptible: a hero at the shop with gold reserved finishes the purchase first.
4. **Records reasons.** Every adoption, pause, and drop, and every agenda position, is recorded with the ranks, weights, and vetoes that produced it.

**Logical conflicts are context conditions.** Expand's context requires the threat assessment to see no threat at its site, so a defense there pauses the expansion with that reason. Competition for units and money is not a conflict here; Allocation resolves it.

### 4.7 Intentions

An Intention kind is a goal with:

- **Conditions over Beliefs and Assessments:** achieved, impossible, and context (whether it can be pursued now).
- **Methods, its Plans:** each one is applicable (a precondition), has a preference, and starts a run.
- **Requests:** Desires for its subgoals.
- **A failure policy:** how long a failed method is excluded, how many attempts are allowed, and then whether to recur (wait and retry) or fail.

**One small generic runtime does the means-end reasoning**, so Intention kinds do not reimplement it.

- It chooses the best applicable method, breaking ties deterministically, and steps its run.
- When a method fails, the runtime:
  - records the reason;
  - excludes the method for the time its policy says;
  - tries the next one.
- When no method applies, the Intention pauses to recur or fails, as its policy says.

**An Intention's state is two fields, each with a reason:**

| Field    | Values                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| State    | **active** · **paused**: context false, or waiting to recur until T · **finished**: achieved, failed, dropped, or aborted |
| Progress | **idle**: needs nothing now · **starved**: its needs are unmet, held by Y · **running**                                   |

**Suspension needs no protocol of its own.**

- An Intention whose needs go unmet is starved. One whose context failed is paused. Either way it keeps its state, and it holds nothing that needs releasing, because Allocation recomputes every round.
- Resuming is a decision, not a replay:
  - Before a starved or paused Intention is stepped again, its conditions and its reason are re-checked, and it may be dropped instead.
  - Method runs are re-entrant: when stepped again they work out their phase from Beliefs, and re-check the conditions they rely on.
- A starved opportunity is dropped once its window passes: its Desire gets weight 0, so the Intention has lost its reason.

**Ending cleanly.** When an Intention is aborted or dropped, its run gets one last call to return cleanup Directives, such as canceling queued production or calling back a builder. Only then does Allocation take its units.

**Method runs** are small, explicit state machines. A run:

- declares its needs;
- returns Directives;
- reports its status;
- monitors its own progress: it has an expected progress and a stall timeout, after which it repairs itself, replans, or fails;
- reports its interruption cost: what interrupting it now would waste, by name, such as a fight under way, a builder already at the site, or a camp half cleared. A step that must not be interrupted at all, such as a Town Portal about to take effect or a purchase being made, marks itself uninterruptible for a bounded time.

Named, grounded costs keep Intentions written by different authors on one scale. A bare number would let any Intention inflate its own priority.

An Intention receives its force (the units and budget allocated to it) as an argument, and returns Directives rather than calling a capability. That makes it data in and data out.

```ts
// An Intention kind (sketch).
const creep = intentionKind<CreepGoal>({
  kind: 'Creep',
  achieved: ({ goal, beliefs }) => heroesReachedLevel({ goal, beliefs }),
  impossible: ({ beliefs }) =>
    reachableCamps({ beliefs }).length === 0 ? 'no camps left' : null,
  outOfContext: ({ goal, beliefs }) =>
    anyHeroAlive({ goal, beliefs }) ? null : 'all heroes dead',
  methods: [creepWithArmy, creepWithAncientTank, soloHeroCreep],
  requests: ({ goal, beliefs }) => healingItemsWanted({ goal, beliefs }),
  failure: { excludeSeconds: 60, attempts: 3, whenExhausted: 'recur' },
});

// A method's run (sketch).
interface MethodRun {
  needs({ beliefs }: { beliefs: Beliefs }): Needs;
  step({ beliefs, force }: MethodRunStepArgs): MethodStep; // status, directives, reason
  interruptionCost(): InterruptionCost; // named losses; uninterruptible until when
  abort({ reason }: { reason: string }): readonly Directive[];
}
```

The Intention kinds the scenarios need:

| Intention kind                  | Adopted for                         | Methods, for example                                             | Needs                                              |
| ------------------------------- | ----------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| RunEconomy                      | concern                             | harvest toward worker targets                                    | workers (default owner), the main hall             |
| MaintainSupply                  | concern                             | build ahead of predicted food                                    | a builder, money                                   |
| Reserve                         | concern                             | gather near defenses, stay safe                                  | military units nobody else claimed (default owner) |
| ExecuteStrategy                 | concern, for the preferred playbook | follow the playbook's phases                                     | nothing; it proposes Desires                       |
| ExecuteOpening                  | playbook                            | follow the opening book                                          | builders, producers, money                         |
| ReachTech, ProduceArmy          | playbook                            | construct, research, or train after resolving requirements       | builders, producers, money, food                   |
| TrainHero, HireHero, ReviveHero | playbook, concern                   | train at the Altar; hire through a visitor timed to readiness    | the Altar or a visitor, money, food                |
| AcquireItem                     | requests, playbook                  | buy with the hero                                                | the hero, money                                    |
| Scout                           | concern, playbook                   | visit candidates by likelihood                                   | one cheap mobile unit                              |
| Creep                           | playbook                            | with the army; with an Ancient as tank; hero alone               | heroes, army strength suited to the camps          |
| HarassEnemyHero, RaidBase       | playbook                            | hit and run; raid workers                                        | a mobile hero or units                             |
| DefendBase                      | concern                             | hold near defenses and Moon Wells; Town Portal or Staff when far | strength above the threat, arriving in time        |
| ProtectUnit                     | requests                            | reach and cover                                                  | units able to reach in time                        |
| Attack                          | playbook                            | choose the target, travel, siege, skirmish                       | an army above a minimum strength                   |
| Expand, ClearCamp               | playbook, requests                  | clear the site, then build                                       | a builder, money, an army                          |

**One Intention, several groups.** An Intention pursues one Desire. When an operation needs coordinated groups, it declares several needs and steers each group with its own Tactic. An example is an attack that pins the enemy army while the Demon Hunter hits the workers.

### 4.8 Allocation

An Intention declares its needs:

- **Unit needs:**
  - a matcher: a given unit, unit types, or a class such as army;
  - an amount: a count with a minimum and a maximum, or the fighting strength required, measured by the combat estimate;
  - a preference: closest by travel time, healthiest, already held.
- **Money needs:** gold, lumber, food.
- **Producers:** buildings are units, so they are matched like any other.

Each round, Allocation walks the agenda in order:

1. **Picks units.** An Intention keeps the units it already holds first; this stickiness avoids churn. Then it gets free units, then units held by Intentions lower on the agenda. Within each group it follows the need's preference, and it stops as soon as the need is met: a defense against one Footman takes the nearest Archer, not a hero from across the map. The switching rule decides whether a unit may move from its holder:
   - nothing moves out of a step marked uninterruptible;
   - otherwise, a challenger with a higher rank wins;
   - a challenger with the same rank wins only if its weight exceeds the holder's by the switching margin: a commitment constant plus the holder's interruption cost.

   The switching rule is IRMA's filter override in numeric form, and each of its terms is recorded.

2. **Applies the minimum.** A need whose minimum cannot be met gets nothing, so units are not wasted on a force too weak to act.
3. **Reserves money.** Money is reserved against the stock plus a short projection of income. An unmet need reports when it becomes affordable; that is how saving works.
4. **Assigns leftovers to default owners.** Workers nobody asked for go to RunEconomy, army units and heroes to Reserve.
5. **Records every grant and denial with its reason.**

Allocation rests on these rules:

- **Needs are declared again every round.** An Intention that ends, or stops needing a unit, loses it without having to release anything.
- **One owner per unit.** A production building belongs to ProduceArmy while it trains and to Creep while it tanks, never to both. A Directive for a unit the Intention does not own is rejected and recorded as a bug.
- **Reserved money is spent only by its holder.** Gold reserved for a hero is not spent on Archers.
- **Every starvation has a named cause:** a higher Intention that was served, or a holder the switching rule protected. The decision record holds it, and tests can assert it. Apart from that protection, Allocation works like AgentSpeak(RT)'s scheduler, which admits intentions in priority order and recomputes the set every cycle.
- **No special owners.** Workers, scouts, and builders are ordinary needs.

### 4.9 Execution

```text
Intention        Harass the Archmage with the Demon Hunter            rank Game plan, weight 0.6
  Method         hit and run: search → engage → disengage → recover
    Tactic       HitAndRun around the Archmage                        leash 800, chase at most 3 s
      Directive  Demon Hunter: Engage(Archmage), role Harasser, retreat at 45 % life, fallback at the camp
        Unit Behavior (Demon Hunter)
          reflexes       escape when trapped (Staff) · retreat when low · dodge area damage
          skills         Mana Burn · Immolation
          opportunities  last hit · finish a dying unit in range
          task           attack and reposition as directed
```

Each level uses the formalism that fits it, instead of one formalism everywhere:

| Level             | Decides                                       | Formalism                                                                       |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Deliberation      | what to pursue                                | ranks and weights over conditions                                               |
| Intention runtime | which method                                  | applicable methods, preference, bounded failure policy                          |
| Method            | the steps of one way to pursue the goal       | an explicit, re-entrant state machine that monitors its own progress            |
| Tactic            | a group's fight or flight, targets, positions | persistent engagement state with hysteresis; utility pickers                    |
| Unit Behavior     | one unit's next order                         | reflexes preempt; then ordered skills, opportunities, task; pickers for targets |

**Tactics** are reusable group controllers that methods run: Travel, Skirmish, CreepCamp, HitAndRun, Siege, Hold, Recover. Each Tactic:

- **Keeps its group's fight-or-flight state across updates.** Engaging and disengaging have separate thresholds, and there is a minimum time between switches.
- **Evaluates fights** with the combat estimate plus named modifiers: near home, at a choke, caught by faster enemies, already committed.
- **Picks targets and positions with utility pickers:**
  - a kill order: healers, casters, summons, repairing Peasants;
  - focus fire without overkill;
  - spreading out against area damage.
- **Takes local opportunities** within the latitude its method gave it.
- **Reports its status upward:** ongoing, won, retreated, stalled, or imminent failure.

**Directives** come from a closed vocabulary. They are constraints, not micromanagement:

```ts
// A Directive (sketch).
interface Directive {
  unit: UnitId;
  task: Task; // Move, Engage, Hold, Harvest, Build, Repair, Produce, UseItem, Purchase, PickUp…
  role?: Role; // how to play it: Harasser, Tank, Damage, Support, Scout, Bait
  latitude: Latitude; // retreat threshold, opportunism, leash
  station?: Point; // where to stand while engaging
  fallback?: Point; // where to retreat to
}
```

**Unit Behaviors.** Every own unit, buildings included, has one Unit Behavior, chosen by its unit type and owned by the mind. Each tick it:

1. **Runs its reflexes first:**
   - survive;
   - escape when trapped;
   - dodge area damage;
   - cancel a construction about to be destroyed;
   - eat a tree.

   A reflex may override the Directive, the way Killzone 3's bots "temporarily ignore orders in order to survive". The owner of the unit does not change.

2. **Then tries ordered modules:**
   - skills: abilities and items, used as the role suggests;
   - opportunities, within the latitude;
   - the task, with the technique of its unit type, such as kiting or attack timing.

Each module returns a verdict with its reason. Roles, not unit types, select the policy: the Demon Hunter burns the enemy hero's mana as a Harasser and the casters' mana as Damage. Different strategies play the same hero differently through the roles their methods assign and their playbooks' skill and item builds. Per-unit memory, such as kiting state or the last target, lives with the Unit Behavior and survives changes of owner.

```ts
// A Unit Behavior composed from shared modules (sketch).
const demonHunter = unitBehavior({
  reflexes: [escapeWhenTrapped, retreatWhenLow, dodgeAreaDamage],
  skills: [manaBurn, immolation, metamorphosis],
  opportunities: [lastHit, finishDyingInRange, pickUpItem],
});
```

**The hierarchy contract**, from Killzone 3:

- **Orders go down** as constraints from a closed vocabulary.
- **Feedback goes up** only as status (completion, stall, imminent failure) and through Beliefs (threats seen).
- **Units may deviate to survive.**

### 4.10 Opportunities and latitude

| Level      | Examples                                                                                                    | Decided by                  | Bounded by                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------- |
| Unit       | last hit (2.16), finish a dying unit in range (2.15), pick up a dropped item, Mana Burn a passing caster    | Unit Behavior opportunities | the Directive's latitude                              |
| Group      | finish a camp the Humans left wounded (2.21), kill exposed workers on the way, chase a fleeing hero briefly | the Tactic                  | the leash, time, and risk its method gave it          |
| Operation  | switch the harassment to a worker line, take a mercenary camp on the route (4.17)                           | the Intention's method      | the Intention's goal                                  |
| Commitment | raid a fresh expansion (1.4, 2B.1), attack because the enemy army died (1.20, 5.18)                         | a Desire, then Deliberation | rank and weight on the agenda, and the switching rule |

**Every level weighs an opportunity the same way.** Its value, minus the detour, the risk, and the value of what it interrupts, must exceed a threshold, within the latitude given. Values come from Knowledge: unit worth, experience, item worth.

**Latitude is the filter of Bratman, Israel and Pollack's IRMA architecture** ("Plans and Resource-Bounded Practical Reasoning"). Options incompatible with current commitments are rejected cheaply. Only strong enough options override the filter and reach deliberation.

- A scout's Directive allows free opportunism, so it may chase a lone Peasant.
- The Wisp traveling to the Tavern allows none, and has a deadline.
- A decisive fight lets cheap units fight to the end, while heroes keep a high retreat threshold.

**Nothing reports opportunities upward.** Whatever any unit sees enters the Beliefs, and concerns and the playbook, reading Beliefs and Assessments, turn what matters into Desires. Intentions only request what is specific to them, such as help or an item.

### 4.11 Strategy, playbooks, and production

**Choosing a strategy.**

- The strategy concern proposes executing the playbook it prefers for the matchup and the recognized enemy plan. It switches playbooks when no adaptation of the current one answers the enemy well enough.
- There is one strategy at a time, because the strategy concern proposes only the playbook it prefers.
- Switching needs a clearly better score and a minimum time on the current playbook: AMAI requires 1.05× and a minimum strategy time.

**From strategy to Desires.** The strategy concern's Desire, `ExecuteStrategy{playbook}`, is adopted like any other: the resulting Intention is the committed strategy. It keeps the playbook's current phase, and the playbook's rules propose the Desires that carry the strategy out, such as `TrainHero{Demon Hunter}` or `Attack`. Those compete on the agenda with every other Desire, so a threat at home still outranks the plan. Fast Bears and the Human tower rush are each one playbook.

**A playbook is typed data plus small functions:**

- phases with entry conditions;
- an opening book in a small language;
- production goals as desired totals with ranks and weights, and gates: upkeep, tier pacing;
- desire rules per phase;
- expectations about the enemy, and adaptations keyed by enemy plan categories;
- hero skill and item builds;
- style knobs (aggression, risk tolerance, persistence), optionally drawn per game from the seeded random source to vary play.

**The opening language** follows Steamhammer's: items, `N x`, `@ location`, commands, barriers. Commands propose Desires.

```ts
// Illustrative opening, not a tuned build (sketch).
const fastBearsOpening = opening({
  steps: [
    '5 x wisp',
    'altar of elders',
    'wisp',
    'moon well',
    'go scout enemy start',
    'ancient of war',
    'train demon hunter',
    'go creep demon hunter with ancient of war',
    "hunter's hall",
    'barrier',
    'tree of ages',
  ],
});
```

**Production after the opening** belongs to ordinary Intentions: ProduceArmy, ReachTech, MaintainSupply, HireHero, ReviveHero, AcquireItem, Expand. Their methods:

- resolve prerequisites from Knowledge before committing;
- count what exists and what is in production toward desired totals, so recomputed Desires never double-build;
- detect jams: no progress within a minute is recorded with a reason, and the method replans;
- make emergency reactions idempotent.

**The Fast Bears playbook for Night Elf versus Human.** A phase adds to the Desires of earlier phases and may change their weights; a goal already reached is no longer proposed.

| Phase       | Entered when                                          | Desires it proposes                                                                                                                                                                               |
| ----------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening     | the game starts                                       | the opening book; `TrainHero{Demon Hunter}`; `ProduceArmy{5 Archers}`; `Scout{enemy start, then hero and tech}`; `Creep{Demon Hunter with the Ancient of War, until level 2}`                     |
| Harass      | the Demon Hunter reaches level 2                      | `AcquireItem{Demon Hunter, Staff}`, `HarassEnemyHero{main hero}`, and `Creep{Demon Hunter}`, in falling weight; `ReachTech{Tier 2}`                                                               |
| Second hero | Tier 2 is being researched                            | `HireHero{slot 2: Naga or Brewmaster}`; `Creep{second hero, Archers, Ancient of War, until about level 2.5}`                                                                                      |
| Reunite     | the second hero reaches about level 2 to 2.5          | `Creep{both heroes and the army, toward level 3}`; `ReachTech{Master Training}`; `ProduceArmy{Druids of the Claw}`; the harassment at a lower weight, so an engagement under way can finish (5.1) |
| Bear timing | Master Training is done and the army is strong enough | `Attack{most valuable vulnerable enemy base}`; `ProduceArmy{reinforcements}`                                                                                                                      |

**Adaptations** are rules on the recognized enemy plan, other Beliefs, and Assessments that change ranks and weights, and add or withdraw Desires. They scale with the recognition's confidence: a close call between two plans is better answered by scouting the building that decides it than by countering both.

| Enemy plan or event                  | Adaptation                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Tower rush (1.1)                     | Tier 2 later, units and defensive structures earlier, no harassment                      |
| Fast expansion (1.4)                 | `RaidBase` on the expansion, ranked Game plan; consider an earlier timing                |
| Tier 2 rush, mass Footmen (1.5, 1.6) | Harassment weighted lower so the Demon Hunter stays near home; more defensive production |
| Composition observed (3.11, 3.12)    | Second-hero preference, decided when the hero is hired                                   |
| Enemy army beaten (1.20, 5.18, 6.23) | `Attack` ranked Game plan, its weight decaying as the enemy rebuilds                     |
| Flying army (6.17)                   | Anti-air composition                                                                     |

**Expectations** are adaptations that guard the playbook's own assumptions, such as "no air units before 8:00". An absence counts only where scouting coverage says the units would have been seen. A broken expectation runs Deliberation early, and the decision record names it as the reason for the change. This is EISBot's goal-driven autonomy in a small form.

### 4.12 The enemy model

The enemy model lives in Beliefs and is fed only by Perception:

- **Contacts.** Every unit and structure seen, with its visibility state. Ghosts are invalidated when their position is seen empty.
- **Inferred tech.** Requirements are walked back from every type seen. A Druid of the Claw implies an Ancient of Lore and Tier 2.
- **Particles for unseen units**, as in EISBot:
  - one per enemy unit seen;
  - weight decays per class;
  - particles drift toward chokepoints;
  - they are culled by own vision;
  - heroes keep identified tracks.

  In EISBot this beat last-known positions and helped win more games.

- **Plan recognition.** The enemy's plan is recognized against a library of known strategies, kept as data: tower rush, fast expansion, Tier 2 rush, mass Footmen, and as many more as the playbooks need answers to. Each strategy lists its signs as fingerprints: composable, timed predicates over contacts, such as "two Barracks by 3:00, no Lumber Mill". Recognition:
  - matches what was seen against every strategy in the library; an absence counts only where scouting coverage says the sign would have been seen;
  - keeps its answer stable: a new hypothesis takes over only when it clearly beats the current one;
  - runs every few seconds and incrementally, so hundreds of strategies stay within budget;
  - publishes a small result: the top one or two hypotheses, each with a confidence, since when it has held, and the signs that matched, plus what would tell them apart, for scouting to look for.

  It is a sizable subsystem with a narrow output, and it can be tested alone and measured offline against replays. Steamhammer found even a crude recognizer a clear net win.

- **The army estimate and its projected movement.**
- **Scouting coverage:** where and when the bot has looked, which tells which absences mean something.

What the enemy model means for the bot, such as threats to own assets and danger by region, is in Assessments ([section 4.4](#44-assessments)).

Belief quality can be measured offline, because a test harness knows the ground truth and the bot does not.

### 4.13 Timing and budgets

| Work                                            | Pace                                                                  | Runs earlier on                                            |
| ----------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| Perception and fast Beliefs                     | every tick                                                            | —                                                          |
| Unit Behaviors                                  | every tick, round-robin within a budget, units nearest a threat first | an own unit attacked                                       |
| Tactics                                         | 0.2–0.5 s                                                             | enemies appearing near the group                           |
| Intentions and methods                          | 0.5–1 s                                                               | a Tactic's status, a unit lost                             |
| Desires, Deliberation, Allocation               | about 1 s                                                             | a new threat, a broken expectation, an Intention finishing |
| Slow inference: particles, the army estimate    | 1–2 s, spread over ticks                                              | —                                                          |
| Enemy plan recognition                          | every few seconds, incrementally                                      | a new enemy building type seen                             |
| Assessments: threats, danger, relative strength | 1–2 s, spread over ticks                                              | enemies seen near own assets                               |

- Each kind of work has a weight and a guaranteed maximum number of skipped ticks, so nothing starves.
- Long analyses resume across ticks.
- The decision record counts the work done, so bounded work can be asserted in tests. When ticks run long, cheaper fallbacks take over.

PurpleWave's frame-time overruns are the cautionary example.

### 4.14 The decision record

Each tick produces one record of plain data:

- the Assessments that changed, with their inputs;
- the Desires and their proposals (source, rank, weight, reason);
- every Intention adopted, paused, or finished, and why;
- the agenda;
- Allocation's grants and denials, with the terms of the switching rule;
- each method's phase and transitions;
- each Tactic's status;
- the Directives;
- each unit's chosen module and reason;
- the orders;
- work counters.

The record has several uses:

- **One structure, four readers:** the in-game debug overlay (status text over units and groups), logs, the trace saved by end-to-end tests, and assertions in behavioral tests.
- **Bounded storage:** records live in a fixed-size ring buffer with channels, so recording fits the Lua budget.
- **A change log:** strategy, phase, adopted Intentions, and key inferences are logged when they change.
- **A dump on bugs:** an invariant violation, such as a unit with two owners or a Directive for a unit not owned, dumps the last records.

### 4.15 Why each part is needed

Each part answers a question nothing else answers:

- **The boundaries.** Without them, fair information and testability would depend on discipline.
- **Fixed phases.** Without them, bugs come from module order.
- **Assessments.** Without them, every reader works out again what the situation means, and two readers reach different conclusions.
- **Desires separate from Intentions.** Otherwise every attractive opportunity becomes behavior at once, and threats and opportunities have no common place to be compared.
- **The agenda.** Without it, conflicts are decided by update order.
- **Allocation.** Without it, each Intention picks its own units and special cases multiply.
- **Methods.** Without them, an operation has one way to succeed, and its failure is the Intention's failure.
- **Tactics.** Without them, every operation reimplements fighting.
- **Unit Behaviors.** Without them, every Tactic reimplements every unit's micro and reflexes.
- **The decision record.** Without it, behavior can be watched but neither explained nor asserted.

What was removed answered questions the remaining parts already answer:

| Removed              | Now answered by                                            |
| -------------------- | ---------------------------------------------------------- |
| Actor Control        | Allocation and reflexes                                    |
| Scoped Beliefs       | one world model plus execution state                       |
| The component tree   | plain ownership                                            |
| Desire supports      | proposals asked each cycle                                 |
| Capability providers | arguments and returned Directives                          |
| Intention Scheduling | the agenda and Allocation                                  |
| Command Arbitration  | each Unit Behavior, the single decision point for its unit |
| Execution roles      | Directives                                                 |

## 5. Testability

The project asks for three kinds of tests. This section describes the properties of the architecture that make them easy, not a test plan.

**Easy scenario setup:**

- A scenario is plain data: a small Knowledge fixture, the initial own state, and a timeline of observations, or built Beliefs and Assessments.
- One fresh mind runs each test.
- Randomness is seeded, and time advances only when the test steps it.
- Skarupke's observation that "most AI bugs are reproducible with two characters" suggests small first scenarios: one hero against one creep, one Wisp and one mine.

**Wide behavioral tests without Warcraft:**

- Everything between the boundaries runs on synthetic observations.
- Each step can also be tested alone: an assessment or plan recognition from a Beliefs fixture, and Desires and Deliberation from given Beliefs and Assessments, without simulating how a threat was detected.
- Tests assert on the decision record at the coarsest level that pins the behavior. For example: defense ranks above the expansion and receives the army. That is more robust than asserting exact orders.
- Every nondeterministic choice is either a deterministic tie-break or drawn from the injected random source. Small methods and Tactics can therefore be tested exhaustively, by forcing each step to succeed or fail.
- Bounded failure handling keeps that space small enough to cover.

**End-to-end tests in the game:**

- The same mind runs with the real Perception and executor.
- Privileged setup code builds the scenario on a test map.
- Opponents are scripted dummies or Blizzard's AI. AMAI's mode pitting AMAI against Blizzard's AI is a cheap benchmark.
- Assertions are predicates "within N seconds", not exact frames.
- Each run saves its decision record.

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

1. **Adoption.** In its Harass phase the playbook proposes, in falling weight, buying the Staff, `HarassEnemyHero{Archmage}` (rank Game plan, weight 0.6), and creeping with the Demon Hunter. Once he holds the Staff, AcquireItem is achieved and frees him, and Allocation gives him to the harassment, the highest Intention that needs him.
2. **Search.** The method searches where the Archmage was last seen and where camps found cleared suggest his route; both come from the enemy model. The Travel Tactic moves the Demon Hunter with local opportunism, and he creeps small camps on the way.
3. **Contact.** The HitAndRun Tactic directs the Demon Hunter to engage the Archmage as a Harasser, retreating at 45 % life to a fallback point. His Unit Behavior burns mana while the Archmage has enough to lose, and his escape reflex is armed with the Staff.
4. **An expansion appears.** The scouting Wisp sees a Town Hall under construction. Perception adds a contact, and plan recognition now reads the enemy plan as a fast expansion. The playbook adapts and proposes `RaidBase{north expansion}`, rank Game plan, weight 0.85.
5. **Preemption.** Deliberation adopts the raid. Both Intentions have rank Game plan, so the switching rule applies. The raid's 0.85 exceeds the harassment's 0.6 plus its switching margin: 0.05 commitment plus 0.1 for the engagement under way, 0.75 in total. Allocation moves the Demon Hunter, and the harassment is starved: it keeps its state but has no force.
6. **The raid.** The raid's Siege Tactic puts the building Peasant first in its kill order, and the Demon Hunter kills it.
7. **A threat at home.** Five Footmen reach the Night Elf Wisps.
   - The Wisps flee by reflex at once; their owner does not change.
   - The threat assessment weighs the five Footmen against the two Archers and the Ancient of War at home, and rates the threat serious. The base-safety concern proposes `DefendBase{main}` with rank Emergency, and the urgent event runs Deliberation on the next tick.
   - DefendBase needs strength above the threat, arriving within 20 seconds. Allocation fills the need nearest first. The two Archers and the Ancient of War at home are not enough against five Footmen, so it also takes the Demon Hunter, whose Staff lets him arrive in time. The defense outranks the raid, so no margin is needed.
   - Against a lone Footman, the Archers and the Ancient of War would meet the need, and the Demon Hunter would stay on the raid. With nobody at home, the threat assessment would rate a lone Footman small, so it would be ranked Game plan, and its weight, a Wisp or two, would not beat the raid's switching margin: the Wisps would flee, and the raid would go on.
8. **The defense.** The defense's method directs him to use the Staff, and the Hold Tactic fights by the Moon Wells, focusing the Footmen.
9. **Resumption.** With the Footmen dead, the threat assessment clears the threat, and the base-safety concern stops proposing; DefendBase is achieved. The Peasants have evacuated, so the raid's target is gone and it fails with that reason. Before the harassment is stepped again, it is re-checked: the playbook still proposes it and the Archmage is alive, so it gets the Demon Hunter back. Its method re-enters from Beliefs (where the Archmage was last known to be) rather than replaying from where it stopped.

No Intention told another anything. Every switch came from Beliefs, Desires, the agenda, and Allocation, and the decision record holds the reason for each.

### 6.2 Buying the second hero

Scenario 3.

1. **The Desire.** When Tier 2 research starts, the playbook enters its Second hero phase and proposes `HireHero{slot 2}`, rank Game plan, with Naga and the Brewmaster as candidates.
2. **Timing the Wisp.** HireHero's method needs nothing until the predicted Tier 2 completion minus the Wisp's travel time and a margin (3.1, 3.2). The prediction comes from Knowledge (research time) and Beliefs (when the research started); the travel time comes from navigation. Then the method needs one Wisp, which Allocation takes from RunEconomy.
3. **Saving.** Slightly before completion the method also needs the hero's gold and food. Cheaper spending stops in time (3.7), and MaintainSupply builds for the reserved food (3.9).
4. **Travel.** The Wisp travels a safe route with no opportunism.
   - If it dies, the need is unmet again and Allocation sends another (3.3).
   - At the Tavern, the method waits at a safe distance while enemies are near (3.4).
5. **Choosing the hero.** At hire time, the playbook's rule chooses against the latest estimate of the enemy composition (3.11, 3.12). If the Tavern's stock shows the preferred hero is gone, it falls back to the other candidate (3.5, 3.6).
6. **The new hero.** Allocation gives the new hero to the highest Intention asking for heroes: Creep normally, DefendBase if the base is attacked (3.13), a raid if an expansion lies exposed (3.16).

### 6.3 A creep fight interrupted by the Human army

Scenario 4.8.

1. **The fight.** Creep's method engages a camp with the CreepCamp Tactic:
   - the Ancient of War in front, as a Tank;
   - Archers behind;
   - Naga slowing enemies with Frost Arrows;
   - the camp's healer first in the kill order.
2. **The Humans arrive.** The Archmage, Footmen, and a Water Elemental appear. The Tactic re-evaluates the fight with both sides and the remaining creeps. Its engagement state crosses the disengage threshold: the fight is lost unless the last creep dies within seconds.
3. **Splitting up.** It sends two Archers, with local latitude, to finish the creep. Everyone else retreats along a route away from the Humans, Naga first, past the spot where the item will drop.
4. **Micro.**
   - The Archers kite the chasing Footmen. Since Defend weakens their piercing attacks, the Archers' target picker prefers the Water Elemental.
   - Naga's Frost Arrows slow the pursuers.
   - Naga's reflex steps behind the Ancient when she is focused, and she picks up the dropped item as an opportunity within her retreat's leash.
5. **Afterwards.** The Tactic reports that it retreated. The method marks the camp contested and picks one away from the Human army.

## 7. Where a new behavior goes

A behavior goes at the lowest level that has the information and the authority it needs.

| Behavior to add                                                                               | Home                                                   |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Use of an ability or item by a unit type, such as Naga's Mana Shield when focused             | that type's Unit Behavior skills                       |
| Survival and safety of a unit, such as worker flight or hero escape                           | Unit Behavior reflexes                                 |
| A small gain one unit can take alone, such as a last hit                                      | Unit Behavior opportunities                            |
| Coordination of a group in a fight: focus fire, spreading, kill order                         | a Tactic's pickers and engagement rules                |
| A local gain a group can take within its purpose, such as finishing a wounded camp            | Tactic opportunities                                   |
| Another way of carrying out an operation                                                      | a new method of the Intention kind                     |
| A step or choice inside one way                                                               | that method's state machine                            |
| A new kind of operation, such as an escort or a drop                                          | a new outcome kind and Intention kind                  |
| Something any competent player wants in some situation                                        | a concern                                              |
| Something this game plan wants, or an adaptation to the enemy                                 | the playbook                                           |
| What should win a conflict                                                                    | a rank or weight consideration, or a context condition |
| What a situation means for the bot, needed by several parts, such as a threat to an expansion | an Assessment                                          |
| A new enemy strategy to recognize, such as a proxy                                            | an entry in the strategy library                       |
| A new fact or inference about the game, such as the enemy's tech                              | a belief model or inference rule                       |
| How the game works: damage, timings, requirements                                             | Knowledge data or a Knowledge function                 |
| How to get somewhere: route danger, unit size                                                 | map knowledge and navigation                           |

## 8. Changes to the current code

| Current concept                                                                   | Second iteration                                                                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Common Beliefs model and belief container                                         | one world model in sections, plain data, unit ids                                          |
| Warcraft reads inside belief models; orders inside components                     | Perception and the order executor only                                                     |
| Scoped Beliefs, a BeliefsModel per component, registration in the beliefs runtime | dropped: shared facts are Beliefs, the rest is execution state                             |
| Per-component Common Beliefs declarations with generic assemble functions         | dropped: components import the Beliefs type                                                |
| Assemble functions, AssembledComponent, child factories, the component tree       | dropped: owners construct their parts directly                                             |
| Capability providers acting for the running update                                | dropped: Intentions receive their force as an argument and return Directives               |
| Desire supports with ids, refresh, and staleness                                  | proposals asked for each cycle                                                             |
| Permanent Desires                                                                 | concerns (maintenance goals)                                                               |
| Option Generation                                                                 | kept: collects and merges proposals                                                        |
| Deliberation (a fixed policy)                                                     | conditions, an adoption registry, a ranked agenda, reasons                                 |
| Intention (`update`, `assessCommitment`)                                          | Intention kinds (conditions, methods, requests, failure policy) on one generic runtime     |
| Plan, Controller                                                                  | methods (Plans) and Tactics (group Controllers)                                            |
| Actor Control                                                                     | Allocation and Unit Behavior reflexes                                                      |
| `UpdateInterval`                                                                  | cadences of the tick phases                                                                |
| Assessments (private `*.assessments.ts`)                                          | shared interpretations become Assessments; private ones stay in their modules as judgments |
| `debug` messages                                                                  | the decision record and its change log                                                     |

Mapping the current behaviors:

- **Worker safety** becomes the worker reflex.
- **Tower target selection** becomes the Guard Tower's Unit Behavior.
- **AdaptStrategy** becomes the strategy concern.
- **The tower rush** becomes a Human playbook with an operation that establishes the tower position. That operation needs the forward Peasants and repairs the towers. RunEconomy runs the home economy.

`@lib/bdi` shrinks to what is generic and still needed:

- the Desire and proposal types;
- the agenda and Allocation algorithms over abstract assets;
- the Intention kind runtime.

## 9. Roadmap

Each step leaves a working bot and updates the architecture documents.

1. **The mind shell.**
   - Perception with unit ids, the order executor, `createMind` and its tick phases, and a first decision record.
   - Existing Warcraft reads and orders move behind the boundaries, with no behavior change.
2. **One world model.**
   - Beliefs in sections, with enemy contacts and neutral camps, and the first Assessment: threats to own assets.
   - Drop Scoped Beliefs, the beliefs runtime's registration, and the component tree.
3. **Desires, Deliberation, Intention kinds.**
   - Proposals, ranks and weights, conditions, the agenda, and the generic Intention runtime.
   - Port the current behaviors: AdaptStrategy becomes the strategy concern; the tower rush becomes a playbook and its operation.
4. **Allocation.**
   - Units first, then money with projected income.
   - Remove Actor Control.
5. **Unit Behaviors and Directives.**
   - Worker safety becomes the worker reflex; tower targeting becomes the Guard Tower's task.
   - Then the first Tactics (Travel, Skirmish), the combat estimate, and navigation on map data.
6. **Production.**
   - The opening language.
   - Production Intentions with desired totals and jam detection.
   - Gates for tier pacing and upkeep.
7. **The enemy model and scouting.**
   - Contacts with ghosts, inferred tech, plan recognition with its strategy library, particles, and coverage.
   - The danger and relative strength Assessments.
8. **The Night Elf game plan.**
   - The Fast Bears playbook, phase by phase.
   - Each phase brings its Intention kinds, methods, Tactics, and Unit Behaviors, with the scenarios as acceptance cases.

## 10. Risks and open questions

1. **Calibration.** The agenda is only as good as the ranks and weights feeding it.
   - Ranks with fixed meanings, weights from value estimates, and proposals concentrated in a few places (concerns and playbooks) keep tuning manageable.
   - Interruption costs are grounded in named losses, which keeps them on one scale.
   - The decision record shows why something won.
2. **The combat estimate.** Fight or flight at every level depends on it.
   - Start with a cheap strength estimate (AMAI's and PurpleWave's) plus named modifiers.
   - Calibrate it with in-game probes, and add simulation only where decisions go wrong.
3. **Plan recognition.** Under fog, recognition is often ambiguous, and a wrong call becomes a wrong adaptation. Adaptations scale with the recognition's confidence, scouting resolves close calls, and accuracy can be measured offline against replays.
4. **The Lua budget.** Unit Behaviors every tick for about a hundred units, plus inference, must fit. Measure early, with the work counters in the decision record.
5. **Game data.**
   - Liquipedia answers the research environment only through web.archive.org, page by page. Extract game data from the game's own files and version it by client build.
   - The source catalogue gives the current patch as 3.0.1 (build 24342).
6. **Map data.** Map knowledge comes from the build-map tooling, and its format still needs a contract.
7. **Order semantics.**
   - Scripts cannot queue orders, and re-issued attacks restart.
   - Ability and item orders need verifying in the game, skill by skill.
8. **What Perception can read.** Some Beliefs the scenarios rely on may not be readable through natives, or not fairly; shop and Tavern stock above all. Each needs an in-game probe. A fact that cannot be read must be inferred, for example stock from a failed purchase.
9. **Automating end-to-end tests.** Launching Warcraft III into a test map, at speed and with a fixed seed, is unverified.
10. **Persistence across games.** Whether a map script can keep an opponent model between games is unknown. Without it, the opponent model lasts one game.
11. **The generic Intention runtime must stay small.**

- It earns its place only by removing duplication from Intention kinds.
- Anything that cannot be explained in a paragraph belongs to a kind, not to the runtime.
