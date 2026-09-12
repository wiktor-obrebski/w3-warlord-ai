# WC3 Warlord AI

This document describes the proposed architecture for a new Warcraft III melee bot built from first principles.

The goal is not only to create a capable player, but to create an AI that is **maintainable, observable, testable, and able to reason under the same incomplete information available to a human player**.

The bot should be able to:

- play complete melee matches;
- operate without hidden-information advantages;
- remember and infer information from scouting;
- maintain long-term strategic objectives;
- pursue several activities concurrently;
- allocate units and economic resources between competing objectives;
- interrupt and resume activities as circumstances change;
- react quickly to tactical events;
- explain why important decisions were made;
- be tested both outside Warcraft and inside the actual game engine.

The architecture combines several complementary ideas:

- **Wurst** as the development language, compiled to Warcraft-compatible JASS;
- a strict [Perception](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#perception) boundary between the game and the bot;
- an explicit [World Model and Beliefs](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#world-model-and-beliefs) representation for partial information;
- [Assessment](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#assessment) that interprets known information;
- long-lived [Strategic Goals](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#strategic-goals), including achievement and maintenance goals;
- utility-based [Goal Evaluation](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#goal-generation-and-evaluation);
- BDI/PRS-style concurrent [Intentions](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#intentions) with explicit intention scheduling;
- explicit, continually adaptable [Plans](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#plans) and [Execution Monitoring](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#execution-monitoring);
- RTS-specific [Resource Arbitration](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#resource-arbitration) with explicit unit assignment and command authority;
- strategic navigation above Warcraft's local pathfinding;
- fast [Reactive Tactical Controllers](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#reactive-tactical-controllers), using Behavior Tree-style control where useful;
- centralized scheduling across different reasoning and control timescales;
- a strict distinction between internal reasoning and executable [Actions](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#actions);
- extensive [Testing](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#testing).

The architecture should be treated as a set of **clear responsibility boundaries**, not as one rigid sequential pipeline. Different systems can operate at different frequencies and react to different kinds of events.

---

## Runtime environment and Wurst

Warcraft III melee AI scripts execute in Warcraft's dedicated JASS AI runtime. That environment provides useful game-specific AI functionality, but JASS itself is a poor language for implementing and maintaining a large modern software system.

The bot should therefore be developed primarily in **Wurst** and compiled into JASS for execution by Warcraft:

**Wurst source → generated JASS AI script → Warcraft III AI runtime**

Wurst gives us:

- static typing;
- packages and imports;
- classes and structured data;
- better local-variable handling;
- compiler-managed function ordering;
- reusable abstractions;
- substantially better development tooling.

Generated JASS should be considered a build artifact rather than the primary source representation.

Warcraft AI scripts run in a more restricted environment than ordinary Warcraft map scripts, so the project should provide a small **AI-specific Wurst runtime layer** rather than assuming the complete map-oriented Wurst standard library is safe.

That layer should expose:

- Warcraft AI natives;
- known-safe Warcraft functions;
- AI-compatible timing facilities;
- data structures suitable for generated JASS;
- debugging and diagnostics;
- project-specific abstractions over low-level game APIs.

This lets the rest of the bot be written in terms of concepts such as beliefs, goals, intentions, resource claims, and assessments rather than JASS implementation details.

---

## Architectural overview

At a high level, the bot operates as a continuous feedback system:

**Warcraft World**

↓

**Perception**

↓

**World Model / Beliefs**

↓

**Assessment**

↓

**Goals and Immediate Needs**

↓

**Goal Evaluation and Deliberation**

↓

**Concurrent Intentions**

↓

**Intention Scheduling and Resource Arbitration**

↓

**Plans, Unit Assignment, and Reactive Controllers**

↓

**Command Arbitration**

↓

**Actions**

↓

**Warcraft World**

The next observation then closes the loop.

This should not imply that every decision waits for every stage to run.

For example:

- strategic reasoning may run only occasionally;
- economic assessment may update roughly once per second;
- intention execution and monitoring may update several times per second;
- combat micro may react much more frequently.

This separation of [multiple timescales](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#multiple-timescales) is an important part of the design.

Intentions, plans, and controllers also have different responsibilities:

- BDI/PRS reasoning decides which commitments matter and which should progress;
- plans describe the current method for fulfilling those commitments;
- reactive controllers handle fast local execution.

The architecture is therefore better understood as interacting decision systems with explicit boundaries than as one synchronous pipeline.

---

## Perception

Perception is the only layer responsible for directly reading the Warcraft environment.

Its output represents **what the bot can legitimately perceive at the current moment**.

Typical information includes:

- visible friendly units;
- visible enemy units;
- visible structures;
- current resources;
- hero state;
- researched upgrades;
- currently visible terrain;
- state and orders of the bot's own units.

Perception should not:

- remember previous observations;
- infer enemy strategy;
- estimate army strength;
- decide what should happen next.

Those responsibilities belong to later layers.

### Why this matters

Warcraft's scripting environment can potentially expose information about game objects that a normal player should no longer know after losing vision.

If arbitrary decision code receives raw Warcraft handles, it could accidentally inspect hidden units and effectively cheat.

The Perception layer creates a hard boundary:

> Enemy information enters the reasoning system only when it is legitimately observable.

Once an enemy disappears into fog, later reasoning must rely on [memory and beliefs](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#world-model-and-beliefs), not the object's hidden current state.

This also makes perception independently testable.

---

## World Model and Beliefs

The World Model represents everything the bot currently believes about the match.

It combines several types of information.

### Current observations

Facts currently provided by [Perception](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#perception).

Examples:

- an enemy hero is visible near a creep camp;
- four Riflemen are visible;
- an enemy expansion is currently visible.

### Memory

Facts legitimately retained from previous observations.

Examples:

- a Blacksmith was seen earlier;
- the enemy hero was last seen at a particular location;
- five Archers were observed twenty seconds ago;
- an expansion existed when last scouted.

### Inferred beliefs

Conclusions that are not directly observed but can reasonably be inferred.

Examples:

- the opponent is probably transitioning into Rifles;
- an expansion is likely to exist;
- an enemy hero may be creeping in a particular area;
- the enemy army is probably weaker after several confirmed unit losses.

Inferred beliefs should support uncertainty rather than pretending every conclusion is certain.

Useful information may therefore include:

- confidence;
- age of information;
- source of knowledge;
- alternative hypotheses.

### Why this matters

A competent RTS player operates neither with perfect information nor with complete forgetfulness.

The World Model gives us the useful middle ground:

> The bot may remember and infer, but it may not magically know.

It is also the natural foundation for:

- scouting;
- opponent modelling;
- uncertainty handling;
- predicting hidden enemy activity.

---

## Assessment

The World Model describes what the bot believes.

Assessment describes **what those beliefs mean right now**.

Examples include:

- relative army strength;
- threat to the main base;
- threat to an expansion;
- likely enemy army composition;
- economic advantage;
- likelihood of an enemy expansion;
- current map control;
- safety of a creep route;
- attractiveness of an attack;
- urgency of retreat;
- vulnerability of an enemy hero.

Assessment can internally consist of specialized systems such as:

- combat assessment;
- economy assessment;
- threat assessment;
- opponent assessment;
- map-control assessment.

They can contribute to one shared assessment model.

### Why this matters

Without this layer, every strategy or behavior module would need to independently reinterpret raw observations and memory.

That creates duplicated calculations and inconsistent conclusions.

Assessment gives the rest of the bot shared concepts such as:

- **enemy army stronger**;
- **base threat critical**;
- **expansion likely**;
- **favorable engagement**.

It also gives us a useful debugging chain:

**Observation → Belief → Assessment → Goal → Intention → Action**

When behavior is wrong, we can identify which part of that chain was responsible.

---

## Strategic Goals

Strategic Goals describe states or conditions that are worth achieving or preserving over relatively long periods.

Examples include:

- reach Tier 3;
- obtain Master Bears;
- level a second hero;
- establish an expansion;
- deny an enemy expansion;
- preserve the army until a timing window;
- gain map control;
- maintain pressure on the enemy economy.

Two broad kinds of goals are useful.

An **achievement goal** aims to make some desired state true.

Examples include:

- reach Tier 3;
- establish an expansion;
- obtain an important upgrade.

A **maintenance goal** aims to keep an important condition true.

Examples include:

- preserve enough army strength to defend the main base;
- maintain sufficient food capacity;
- retain scouting coverage over important areas.

There does not need to be a single global `strategy`.

A Warcraft player normally has several strategic priorities simultaneously.

For example:

- tech progression;
- hero experience;
- army composition;
- economic growth;
- map pressure;
- army preservation.

Different goals may also have different importance depending on playstyle and current circumstances.

### Why this matters

Short-lived events should not automatically destroy long-term direction.

An enemy attack on the base may create an urgent defensive [Intention](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#intentions), while the long-term goal of reaching Tier 3 remains perfectly valid.

Maintenance goals also make it possible to represent conditions that should remain true while other goals are pursued, rather than expressing everything as a one-time task.

Separating strategic goals from tactical behavior therefore provides continuity.

It also lets different playstyles use the same architecture by assigning different values to the same kinds of goals.

---

## Goal Generation and Evaluation

At any moment, many things could be beneficial.

Examples include:

- creep another camp;
- buy a Staff;
- harass workers;
- scout the enemy natural;
- defend the main base;
- produce another Bear;
- save resources for Tier 3;
- establish an expansion.

These possibilities are **candidate goals**.

A candidate goal is not yet something the bot has committed to doing.

Goal evaluation determines how valuable or urgent each candidate currently is, using information from [Beliefs](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#world-model-and-beliefs) and [Assessment](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#assessment).

This can use utility or priority values.

For example, defending the main base may suddenly become far more valuable than:

- continuing to creep;
- buying an item;
- maintaining harassment.

### Why this matters

The architecture explicitly distinguishes:

> **This would be useful**

from:

> **I have committed resources to doing this**

Without that distinction, every attractive opportunity becomes immediate behavior and the bot constantly changes direction.

Goal evaluation gives us context-sensitive choices while [Intentions](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#intentions) provide persistence once a choice has been made.

---

## Intentions

Intentions are goals to which the bot has committed.

An intention is therefore not simply a desired outcome. It represents an activity the bot is actively pursuing.

The bot may have many intentions simultaneously.

For example:

- the Demon Hunter harasses the enemy economy;
- the second hero creeps;
- a Wisp scouts;
- another worker constructs a Moon Well;
- the economy progresses toward Tier 3.

Each intention may carry information such as:

- required or preferred units;
- heroes and workers;
- gold and lumber;
- production buildings or shop access;
- map locations;
- timing opportunities;
- priority;
- urgency;
- interruption cost or policy;
- current status and progress;
- current plan.

Priority and urgency are related but not identical.

A long-term technology intention may have high strategic priority without requiring immediate execution, while an emergency defense intention may become extremely urgent even if it was not previously important.

Conflicts between intention requirements are handled through [Resource Arbitration](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#resource-arbitration) and [Intention Scheduling](#intention-scheduling).

### Why this matters

Intentions provide **commitment**.

A purely reactive system might switch constantly between two nearly equal options as their immediate value changes slightly.

An intention says:

> This objective remains worth pursuing, and the bot will continue pursuing it until something meaningful changes.

This produces stable, purposeful behavior.

Concurrent intentions are particularly important for Warcraft because skilled play routinely involves several independent activities at once.

Concurrency by itself is not enough, however. Active intentions also need explicit coordination so they do not all assume they can progress independently.

---

## Intention lifecycle

Intentions should have an explicit lifecycle.

Typical states include:

- proposed;
- active;
- blocked;
- suspended;
- completed;
- failed;
- cancelled.

An intention should also define information such as:

- success conditions;
- failure conditions;
- required resources;
- interruption policy;
- current progress;
- current plan;
- relevant assumptions.

A temporary event can therefore suspend an intention without destroying it.

For example:

**harass → suspend for emergency defense → defend → reconsider and resume harassment**

A blocked intention remains valid but currently cannot make useful progress, for example because a required resource or safe route is unavailable.

### Why this matters

This gives the bot continuity across interruptions.

Without an explicit lifecycle, temporary tactical events tend to erase ongoing behavior, forcing the AI to rediscover what it had previously been trying to accomplish.

It also avoids assuming that every interrupted activity should simply continue from exactly where it stopped. The intention may remain valid while its old plan has become obsolete.

Lifecycle state gives tests and diagnostics much more meaningful information than simply observing unit commands.

---

## Intention Scheduling

Several intentions may be valid at the same time, but that does not mean they should all progress independently.

Intention Scheduling coordinates the current set of commitments.

It determines questions such as:

- which intentions may progress concurrently;
- which intention should progress now;
- which should wait;
- which should be suspended or preempted;
- which blocked intention can become active again;
- how competing resource requirements should affect progress.

Useful inputs include:

- priority;
- urgency or time pressure;
- expected value;
- existing commitment;
- interruption cost;
- resource requirements and reservations;
- compatibility with other active intentions.

For example, the bot may simultaneously intend to:

- creep a camp;
- establish an expansion;
- progress toward Tier 3;
- scout an enemy expansion.

If the main base is suddenly threatened, the scheduler may suspend or slow some of those commitments, allocate combat resources to defense, and later reconsider the interrupted intentions.

[Resource Arbitration](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#resource-arbitration) is closely related to intention scheduling. Resource Arbitration answers which commitments may use contested assets, while Intention Scheduling uses those constraints together with strategic considerations to decide which commitments can meaningfully progress.

This is different from the [Central timing scheduler](#central-timing-scheduler).

The timing scheduler asks:

> Which reasoning or control system should execute now?

Intention Scheduling asks:

> Which commitments should make progress now?

### Why this matters

BDI provides persistent concurrent intentions, but a real RTS also requires coordination between them.

Without explicit intention scheduling, concurrency can degrade into:

- several commitments waiting on the same resources;
- repeated preemption;
- unstable priority changes;
- independent systems making locally sensible but globally inconsistent decisions.

Treating intention scheduling as part of practical reasoning makes those tradeoffs explicit, inspectable, and testable.

---

## Plans

A Plan represents the current method for accomplishing an [Intention](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#intentions).

Plans may contain:

- concrete actions;
- intermediate goals;
- conditions;
- alternative paths;
- recovery behavior.

Plans can be hierarchical where useful.

For example, a harassment intention might involve:

**prepare → acquire item if needed → travel → find target → harass → escape → recover**

A simple scouting intention may require almost no hierarchy.

The architecture therefore supports decomposition without requiring every action to pass through a large generic task framework.

Planning should generally be **continual**.

The bot does not need to construct a complete immutable plan before acting. It can select enough of a plan to make useful progress, execute it, observe the result, and refine or replace later parts as the situation changes.

### Why this matters

The goal and the method remain separate.

An intention such as:

**harass enemy economy**

may remain valid while the current plan changes because:

- the route became unsafe;
- an item is missing;
- the original target disappeared;
- the enemy army returned;
- the hero needs recovery.

For example, an intention to reinforce an army may remain valid while a plan to use the northern route is replaced with a safer route.

A plan can therefore fail or become invalid without automatically invalidating its intention.

This makes behavior adaptable without discarding the higher-level commitment.

---

## Execution Monitoring

Plans cannot issue commands and assume everything worked.

The bot must continuously compare expected progress with reality.

Execution Monitoring determines whether an intention or its current plan should:

- continue;
- complete;
- fail;
- become blocked;
- suspend;
- refine or replace the current plan;
- create a new problem that requires attention.

Examples include:

- a target disappeared;
- a route became inaccessible;
- the expected creep camp is empty;
- the hero became dangerously injured;
- an expansion was destroyed before the army arrived;
- a purchase failed;
- an unexpected enemy army appeared.

Two different kinds of invalidation should remain distinct.

**Plan invalidation** means:

> The objective is still worth pursuing, but the current method no longer works.

The bot should normally replan or choose another method.

**Intention invalidation** means:

> The committed objective itself is no longer appropriate, possible, or worthwhile.

The intention may then complete, fail, or be cancelled.

### Why this matters

RTS environments change continuously.

A plan that was correct a few seconds ago may now be obsolete even though its underlying goal remains valid.

Execution Monitoring creates the feedback loop:

**intend → plan → act → observe → compare → adapt**

This prevents units from blindly pursuing invalid plans and provides a natural mechanism for failure recovery without needlessly destroying long-lived commitments.

---

## Resource Arbitration

Several active intentions may compete for the same resources.

Resources include much more than units.

They can include:

- heroes;
- army units;
- workers;
- gold;
- lumber;
- production queues;
- production buildings;
- shops;
- transports;
- map locations;
- timing windows.

For example, the same gold might simultaneously be wanted for:

- Tier 3;
- another combat unit;
- a Staff;
- a Moon Well;
- emergency static defense.

Resource Arbitration decides which commitments receive those resources.

It can consider:

- urgency;
- goal utility;
- existing commitment;
- cost of interruption;
- reservation of future resources;
- strategic importance.

Plans and intentions should expose important resource requirements and reservations clearly enough for these conflicts to be reasoned about centrally.

Where useful, they may also expose expected effects relevant to other commitments, such as consuming a production queue or temporarily removing units from base defense.

Resource Arbitration works together with [Intention Scheduling](#intention-scheduling). Resource availability constrains which intentions can progress, while the intention scheduler provides the broader context for deciding which claims should win.

### Why this matters

Without central arbitration, independent systems can make decisions that are individually reasonable but collectively impossible.

Examples include:

- reserving gold for technology while another system spends it;
- assigning one hero simultaneously to harassment and defense;
- several systems trying to use the same production building.

Explicit arbitration makes such conflicts visible, deterministic, and available to diagnostics.

---

## Unit Assignment and Command Authority

Resource Arbitration decides whether an intention may use a unit or other shared resource.

Execution still needs a more precise answer to another question:

> Which controller is currently allowed to command this unit?

The project should therefore maintain an authoritative assignment for controlled units.

For each unit, relevant information may include:

- the intention that strategically owns it;
- its current execution role;
- the controller that currently has normal command authority.

Execution roles may include states such as:

- fighting;
- joining another group;
- scouting;
- withdrawing;
- temporarily evading danger.

Changing execution role can transfer command authority without changing strategic ownership.

For example, a Dryad owned by an **attack enemy expansion** intention might initially be **joining** the main army under a reinforcement controller and later become **fighting** under the Combat Controller.

The unit still belongs to the same intention.

Controllers should not independently discover available units and claim them. Requests to transfer a unit between intentions go through [Resource Arbitration](#resource-arbitration).

At most one normal controller should have command authority over a unit at a time. Short-lived emergency behavior may temporarily override normal control without changing the unit's strategic owner.

### Why this matters

Without explicit assignment, resource ownership alone is too coarse.

Several controllers could each reasonably believe they are responsible for the same unit, causing conflicting movement, duplicated grouping logic, or accidental theft of units from another activity.

Separating strategic ownership from command authority lets the bot preserve long-lived commitments while changing how assigned units are currently being executed.

---

## Command Arbitration

Resource ownership does not completely eliminate conflicting commands.

Several systems may legitimately propose actions for the same unit.

For example:

- targeting logic wants the Demon Hunter to continue attacking;
- positioning logic wants to reposition;
- survival logic wants to use an item;
- an emergency controller wants to Town Portal.

Controllers should normally submit action proposals rather than issue Warcraft orders directly.

Command Arbitration determines which actual command reaches Warcraft.

An emergency proposal may override normal tactical behavior without transferring the unit to another intention or permanently changing its normal controller.

### Why this matters

Without a final authority, independent controllers can continually overwrite one another's orders.

That produces:

- unstable movement;
- cancelled attacks;
- interrupted spells;
- repeatedly changing targets;
- generally erratic behavior.

Command Arbitration provides a single decision point between reasoning and physical game control.

---

## Reactive Tactical Controllers

Not every meaningful decision should become an intention.

Very short-lived tactical behavior belongs in fast reactive controllers.

Examples include:

- focus fire;
- kiting;
- avoiding area damage;
- Mana Burn usage;
- Staff usage;
- preserving a critically injured unit;
- ranged-unit positioning;
- spreading units;
- target selection during an ongoing engagement.

A high-level intention may simply be:

**engage this enemy army**

while the Combat Controller makes many local decisions during the fight.

Behavior Trees are a suitable default structure for controllers that need hierarchical, reactive decision logic.

For example, a Combat Controller might conceptually prioritize:

**survive immediate danger → use critical abilities → reposition → select target → attack**

Behavior Trees are not required for every controller. Navigation, scoring, formation control, or other specialized problems may be better implemented with dedicated algorithms or utility functions.

Local tactical events should normally stay inside the relevant controller.

For example:

- the current target died;
- a ranged unit needs to kite;
- a spell became available;
- a unit needs a small positional correction.

Events that materially change a goal, plan, resource allocation, or several concurrent activities should instead trigger urgent higher-level reconsideration.

### Why this matters

Strategic reasoning and micro operate on very different timescales and levels of abstraction.

Creating intentions for individual attack orders or small movements would overload the deliberative system with meaningless short-lived state.

At the same time, forcing every tactical event through BDI reasoning would put strategic deliberation directly on the latency-critical path.

Reactive controllers let intentions remain focused on goals while specialized systems handle immediate execution.

---

## Strategic Navigation

Warcraft's built-in pathfinding can move a unit toward a point, but it does not decide which strategically meaningful route the bot should prefer.

The bot should therefore maintain a higher-level navigation model above Warcraft's local pathfinder.

### Static map model

Where practical, map topology should be preprocessed outside the AI runtime.

The resulting representation should describe useful strategic structure such as:

- connected regions;
- corridors;
- choke points;
- approximate travel distances;
- start locations;
- gold mines and expansion sites;
- creep camps;
- shops;
- taverns;
- mercenary camps;
- other strategically useful landmarks.

Important places should be attached to the movement topology rather than treated only as isolated coordinates.

This graph is not intended to reproduce Warcraft's detailed pathfinder.

### Runtime route selection

Strategic route selection should combine static topology with the bot's current beliefs about dynamic conditions.

Relevant factors may include:

- known or inferred enemy presence;
- estimated enemy strength;
- danger;
- temporary blockage;
- recently observed changes in accessibility.

Route cost can depend on the travelling group and its purpose.

A small reinforcement group may strongly avoid a dangerous corridor while the main army may deliberately choose that same corridor because it intends to fight there.

Navigation therefore operates conceptually at three levels:

1. choose a strategic route through meaningful regions, corridors, or waypoints;
2. execute movement toward the next strategic waypoint;
3. let Warcraft's local pathfinder handle detailed physical movement.

If observations make the current route unsuitable, the relevant plan or controller can request route replanning.

All dynamic routing decisions must use the [World Model and Beliefs](#world-model-and-beliefs), not hidden Warcraft state.

### Why this matters

Local pathfinding answers:

> How do I physically reach this nearby destination?

Strategic navigation answers:

> Which route should I choose given what I currently know and what this group is trying to accomplish?

Keeping those questions separate lets the bot reason about danger, scouting information, reinforcement safety, and map control without trying to reimplement Warcraft's movement engine.

---

## Multiple timescales

The bot should not reconsider every type of decision at the same rate.

Typical categories may look roughly like:

- immediate tactical control — very frequent;
- intention execution and monitoring — frequent;
- combat and threat assessment — moderately frequent;
- economy and scouting assessment — slower;
- strategic goal reconsideration — substantially slower.

Exact frequencies should be determined experimentally.

Important events may request earlier execution of relevant reasoning rather than waiting for its normal cadence.

For example:

- a base attack;
- discovery of a major enemy army;
- intention completion or failure;
- route invalidation;
- a strategically important resource conflict.

Immediate local tactical events should usually remain inside reactive controllers rather than waking the full deliberative system.

### Why this matters

Some events require near-immediate reaction.

Others do not.

A hero approaching lethal danger cannot wait for a strategic reasoning cycle.

Conversely, reconsidering the entire tech plan many times per second wastes computation and encourages oscillation.

Multiple update frequencies therefore improve:

- responsiveness;
- efficiency;
- behavioral stability.

---

## Central timing scheduler

Prefer one central timing mechanism over unrelated subsystem loops.

The timing scheduler should run at a relatively high base frequency and invoke reasoning or control systems when they are due.

A scheduled system performs one update and returns rather than owning an independent permanent loop.

Urgent events may request that a relevant system execute before its normal scheduled time.

The timing scheduler does not decide which strategic objective deserves resources or which intention should win a conflict.

That responsibility belongs to [Intention Scheduling](#intention-scheduling) and [Resource Arbitration](https://chatgpt.com/g/g-p-6aa515bc270081918a265886dbc55774/c/6aa0f651-5a2c-83ed-ab28-e3e8b9bfb85a#resource-arbitration).

### Why this matters

A central scheduler makes update timing explicit and easier to reason about.

It also makes behavior easier to:

- profile;
- test deterministically;
- reset;
- accelerate or slow in a test harness;
- instrument without hidden subsystem timers.

Most importantly, it keeps two different scheduling problems separate:

- **timing scheduling** — when a reasoning or control system runs;
- **intention scheduling** — which active commitments are allowed to progress.

---

## Actions

Actions are strictly requests to change the Warcraft world.

Examples include:

- move;
- attack;
- cast;
- build;
- train;
- research;
- buy;
- sell;
- use an item.

Internal operations are not Actions.

For example, these are internal state changes:

- updating a belief;
- remembering a building;
- changing goal priority;
- activating an intention;
- suspending an intention;
- changing confidence in an inference.

### Why this matters

This creates a clean boundary between:

**thinking**

and

**acting**

Most reasoning can therefore be tested without Warcraft.

Only the Action executor needs to understand how abstract commands map to Warcraft/JASS operations.

It also prevents internal state transitions from becoming coupled to the mechanics of command execution.

---

## Game Adapter

Warcraft-specific integration should be concentrated around two primary boundaries:

**observe**

and

**execute**

Conceptually:

**Warcraft → Perception → reasoning → Actions → Warcraft**

The reasoning system should operate on project-defined data structures rather than raw Warcraft handles wherever possible.

### Why this matters

This boundary provides several important properties:

- hidden-information access can be controlled;
- most reasoning becomes independent of Warcraft;
- unit tests can construct artificial situations;
- Warcraft API peculiarities remain localized;
- future changes to game integration do not spread throughout the bot.

---

## Internal Events and Diagnostics

The bot should generate structured internal events for meaningful reasoning changes.

Examples include:

- enemy expansion discovered;
- enemy hero lost from vision;
- threat changed from low to critical;
- candidate goal became highly valuable;
- intention activated;
- intention blocked or unblocked;
- intention suspended or resumed;
- intention preempted by another commitment;
- plan changed or failed;
- retreat initiated;
- resource claim rejected.

These events do not affect Warcraft directly.

They exist for observability.

### Why this matters

A complex agent is difficult to debug if the only visible outcome is unit movement.

For an important decision, we should be able to reconstruct:

- what the bot observed;
- what it remembered;
- what it inferred;
- how it assessed the situation;
- which goals were considered;
- which intentions were active;
- why one intention progressed while another waited or was suspended;
- which intention received contested resources;
- why the current plan was selected or replaced;
- why the resulting action was selected.

This gives a reasoning chain similar to:

**Observation → Belief → Assessment → Goal → Intention → Scheduling / Plan → Controller → Action**

This also allows test failures to report semantic reasoning state rather than only raw game data.

### Debug mode

Detailed diagnostics should be explicitly enabled rather than permanently active.

When debugging is disabled, diagnostic code should not meaningfully consume CPU, allocate unnecessary intermediate data, or build large messages that are immediately discarded.

Expensive diagnostic generation should therefore be guarded close to its source.

### Diagnostic artifact

A normal player should be able to enable debugging without modifying or recompiling the bot.

The intended workflow is:

1. enable debug mode;
2. reproduce the problematic behavior;
3. obtain a diagnostic artifact;
4. send that artifact to the developer.

Where Warcraft's runtime permits it, prefer one self-contained structured artifact per game or diagnostic session.

### Why this matters operationally

Many important failures will only appear during real matches.

Diagnostics are most useful if they are cheap when disabled and simple enough that another player can capture a useful report without understanding the bot's internals.

---

## Testing

Testing should influence the architecture from the beginning rather than being added later.

The project should support several complementary levels of testing.

The same core reasoning implementation used by the real bot should also be executable against controlled inputs outside Warcraft. Tests should not depend on maintaining a simplified parallel version of the AI.

### Decision-level tests

Most reasoning systems should be testable using artificial inputs.

Tests can construct:

- observations;
- beliefs;
- assessments;
- candidate goals;
- active intentions;
- resource constraints;
- sequences of events over simulated time.

They can then examine:

- revised beliefs;
- assessment results;
- selected goals;
- intention scheduling decisions;
- intention lifecycle changes;
- plan changes;
- resource allocations;
- unit ownership and controller assignments;
- route selections and replanning decisions;
- generated actions.

No Warcraft process is required.

The central timing scheduler should also be controllable by the test harness so scenarios can advance deterministically.

#### Why this matters

These tests are fast and deterministic.

A complex situation discovered during a real match can be reduced to a small regression test and preserved permanently.

Because the same reasoning code runs in production and in these tests, the test result remains representative of the real bot's deliberation rather than a separate simulation model.

---

### Generated-JASS validation

Wurst output should be validated as legal Warcraft AI JASS.

This verifies:

- compiler integration;
- supported runtime usage;
- generated syntax;
- compatibility with the Warcraft AI environment.

#### Why this matters

Valid Wurst source does not necessarily guarantee that the generated standalone AI artifact is valid for Warcraft's dedicated AI runtime.

The actual deployment artifact must therefore be validated separately.

---

### Real Warcraft integration tests

A dedicated Warcraft test map should support controlled behavioral scenarios.

The harness should be able to:

- create specific units and buildings;
- configure resources;
- configure upgrades;
- position armies;
- start the real AI;
- run the Warcraft simulation for a defined amount of game time;
- inspect the resulting game state;
- report structured results.

Useful scenarios include:

- retreat;
- base defense;
- harassment;
- scouting;
- fog-of-war behavior;
- production;
- item purchasing;
- combat execution;
- strategic route selection and replanning.

#### Why this matters

These tests exercise the actual Warcraft systems:

- pathfinding;
- attacks;
- targeting;
- visibility;
- collision;
- construction;
- cooldowns;
- orders;
- the JASS AI runtime itself.

They therefore catch integration failures that pure decision tests cannot.

---

## Reusing Warcraft across integration tests

The integration harness should normally run multiple scenarios during one Warcraft session.

The expected model is:

**launch Warcraft → load test map → run test → reset → run next test → report results**

The bot should therefore support resetting its logical state.

A smaller number of tests may still require a fresh Warcraft process when game-engine state cannot be reliably restored.

### Why this matters

Game startup is expensive compared with a short behavioral scenario.

Reusing the same process makes a substantial real-engine regression suite practical.

It also encourages explicit bot state and discourages hidden persistent state, which improves the architecture itself.

---

## Architectural boundaries

Several distinctions should remain explicit throughout the implementation.

### Observation is not memory

Observation contains only what is available now.

Memory preserves legitimate historical information.

### Memory is not inference

Memory says what was observed.

Inference says what the bot thinks is probably true.

### Belief is not assessment

Beliefs represent the bot's model of reality.

Assessment interprets that model in decision-oriented terms.

### Goal is not intention

A goal may be desirable.

An intention means the bot has committed to pursuing it.

### Intention is not plan

An intention describes the desired outcome or condition being pursued.

A plan describes the current method.

### Plan failure is not intention failure

A route, sequence, or method may become invalid while the underlying commitment remains worthwhile.

Execution monitoring should distinguish replanning from abandoning the intention.

### Plan is not action

Plans may span seconds or minutes.

Actions are concrete commands sent to Warcraft.

### Intention scheduling is not timing scheduling

Intention Scheduling decides which commitments should progress.

The central timing scheduler decides when reasoning and control systems execute.

### Strategic ownership is not command authority

An intention may continue to own a unit while different controllers command it for different execution roles.

Changing controller authority does not automatically change the strategic commitment that owns the unit.

### Strategic navigation is not local pathfinding

Strategic navigation chooses meaningful routes using topology and beliefs.

Warcraft's pathfinder handles detailed physical movement between those strategic destinations.

### Strategic reasoning is not micro

Strategic reasoning determines what matters.

Reactive controllers determine how units behave moment to moment.

These boundaries are important because most architectural complexity comes from responsibilities becoming mixed rather than from the individual algorithms themselves.

---

## Design principles

### Knowledge must be explicit

For important information, we should know whether it came from:

- current observation;
- memory;
- inference.

This supports fair play and explainability.

### Uncertainty should remain uncertainty

Information that is merely likely should not silently become a fact.

Confidence and information age should be available where useful.

### Commitment must be explicit

Considering a goal and pursuing a goal are different states.

Intentions make this distinction concrete.

### Goals may describe achievement or maintenance

Some goals aim to make a state true.

Others aim to keep an important condition true while the match continues.

### Concurrency is normal

The bot should assume that many independent activities are active simultaneously.

The architecture should not depend on one global behavior mode.

### Concurrency requires scheduling

Active intentions should not advance as unrelated independent loops.

Their progress, interruption, and resource conflicts should be coordinated explicitly.

### Shared resources require coordination

Gold, lumber, units, heroes, production capacity, and command authority must be allocated explicitly.

### Separate ownership from execution authority

An intention owns the strategic commitment. A controller temporarily commands assigned units according to their current execution role.

### Use strategic navigation above local pathfinding

The bot should choose meaningful routes from topology and beliefs while leaving detailed movement to Warcraft.

### Fast reactions should remain fast

Tactical control should not wait for complete strategic reconsideration.

Local tactical events should normally be handled by reactive controllers, while strategically significant changes can trigger urgent higher-level reasoning.

### Plans are provisional

A valid intention can survive the failure of its current plan.

Planning should be continual: act, observe, and refine or replace the method when circumstances change.

### State should be inspectable

Important decisions should be explainable through structured state and events.

Diagnostics should be deliberately enabled, cheap when disabled, and practical for players to capture from real matches.

### Testability is an architectural requirement

The majority of reasoning should be independently testable.

The same core reasoning logic should run in controlled tests and in the real bot.

Important behavior should also be reproducible in controlled Warcraft scenarios.

### Generated JASS is an artifact

Human development happens in Wurst.

Generated JASS is validated and deployed, but should not dictate the conceptual structure of the bot.

---

## Intended result

The project is not intended to implement one monolithic AI algorithm.

It is a structured autonomous-agent system built from:

- controlled perception;
- an explicit partially observable world model;
- memory and uncertainty-aware beliefs;
- shared situation assessment;
- persistent achievement and maintenance goals;
- utility-based goal evaluation;
- BDI/PRS-style concurrent intentions;
- explicit intention scheduling;
- continual, adaptable plans;
- execution monitoring;
- explicit resource arbitration;
- explicit unit assignment and controller command authority;
- fast reactive tactical controllers, using Behavior Tree-style logic where useful;
- strategic navigation above Warcraft local pathfinding;
- deterministic command arbitration;
- centralized multi-timescale execution scheduling;
- a strict cognition/action boundary;
- structured diagnostics suitable for real-match bug reports;
- extensive model-level and real-engine testing;
- Wurst as the maintainable source language.

The main value of this architecture is **clarity of responsibility**.

When the bot scouts an enemy, remembers what it saw, infers an expansion, evaluates denying that expansion as valuable, commits a hero to harassment, temporarily diverts that hero to obtain an item, reacts to an unexpected enemy army, suspends the harassment, survives the encounter, finds that the old route is no longer suitable, selects a new plan, and later resumes its original objective, every part of that behavior should correspond to an explicit architectural concept.

That clarity is what should allow increasingly sophisticated behavior to be added without turning the bot into an accumulation of interacting special cases.
