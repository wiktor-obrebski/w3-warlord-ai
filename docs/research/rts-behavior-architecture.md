# Research: Architecture for Full RTS Gameplay

Status: research proposal for discussion. It is not the adopted architecture; that remains [`ARCHITECTURE.md`](../ARCHITECTURE.md), summarized together with the current implementation in [`ARCHITECTURE_SITEMAP.md`](../ARCHITECTURE_SITEMAP.md).

The proposal starts from a set of Night Elf versus Human scenarios: the default game plan (Demon Hunter and Archers into fast Bears), the Demon Hunter's harassment, the second hero, independent and joint creeping, and the Bear timing attack, each with many deviations. The scenarios are examples of decisions a player makes, not a split of the code. The aim is an architecture in which they, and the hundreds of behaviors they do not list, fit readably.

## 1. Summary

The scenarios show that Warcraft decisions come in a handful of recurring shapes, whatever their topic: a purpose persists while its target, method, or units change; a threat or an opportunity appears in what some unit sees; two valuable activities want the same hero or the same gold; a fight must be won or escaped within seconds; a unit must do the right thing this instant. The architecture should give each shape exactly one home, so that behaviors not listed here also have an obvious place.

The proposal keeps Beliefs, Desires, and Intentions with their current meaning and organizes the bot around five questions, each answered in one place:

| Question                                                    | Answered by                                                                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Know**: what is true, was seen, or is probably true?      | Beliefs (perception, memory, inference) and shared Knowledge (game data, combat model, map)                                   |
| **Want**: what would be worth achieving now?                | Desires from the bot's standing desires, the strategy's playbook, and Intentions' requests, consolidated by Option Generation |
| **Commit**: what do we pursue, and what matters most?       | Deliberation: the Intentions and their order, the agenda                                                                      |
| **Allocate**: who gets which units, gold, lumber, and food? | Allocation: every Intention's needs, served in agenda order                                                                   |
| **Act**: how is each commitment carried out, unit by unit?  | Intention → Plan → Tactic → Directive → Unit Behavior → Warcraft order                                                        |

The main decisions:

1. **Intentions are operations that own assets.** An Intention such as "harass the Archmage with the Demon Hunter" or "defend the main base" declares what it needs: units, gold, lumber, food, production buildings. **Allocation** serves those needs in agenda order. It replaces Actor Control and covers what the target design splits into Resource Arbitration, Unit Assignment, and Intention Scheduling.
2. **Interruption is preemption; resumption is reallocation.** A suspended Intention is one whose units went to a more important one. It keeps its state and continues when they come back, so no suspend and resume protocol is needed. An Intention reports what interrupting it would waste, which protects activities that must not be cut off.
3. **Standing desires** generalize permanent Desires: rules over Beliefs through which the bot itself wants something whenever a situation holds, such as defending a threatened base or reviving a dead hero. What a particular game plan wants comes from the strategy's **playbook**. Intentions still request what they need, such as an item or help.
4. **Every own unit has a Unit Behavior**, chosen by its type, that carries out the **Directive** of whoever owns the unit, with reflexes (survival), skills (abilities, items), and bounded opportunism (last hits, finishing dying units). Unit Behaviors are the only code ordering units, which realizes the execute boundary.
5. **Tactics** are reusable group controllers (skirmish, creep a camp, hit and run, siege, travel, hold, recover) that decide fight or flight, focus fire, positioning, and local opportunities for an Intention's units.
6. **Opportunities are taken at the lowest level that sees them and can afford them, within the latitude it was given.** Bigger ones need no reporting: what any unit sees enters the Beliefs, where standing desires and the playbook turn it into Desires.
7. **Knowledge is shared, judgment is private.** Game mechanics (unit data, combat model, timings, tech requirements) and map knowledge prepared when the map is built are shared, pure, and consistent. Interpretations that every component must agree on, such as threats or the enemy army estimate, become inferred Beliefs. Private judgments remain Assessments.

Dropped or merged: Actor Control (claims, leases, preemptive requests), Command Arbitration, Intention Scheduling as a separate system, execution roles, and per-Intention update intervals, which the Central Timing Scheduler replaces once it is needed.

## 2. What the scenarios demand

### 2.1 Deviations have few shapes

Every deviation in the scenarios has a trigger and needs a response. A scenario can have several of each.

| Trigger                         | Meaning                                                          | Scenarios                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Threat                          | Enemy action endangers own assets                                | 1.1–1.3, 1.8, 1.19, 2.12–2.14, 2B.12, 3.13, 4.3, 4.8, 4.10, 4.14, 4.15, 5.10, 5.14, 6.7, 6.19, 6.20, 6.29, 6.33 |
| Opportunity                     | A temporary chance of gain                                       | 1.4, 1.20, 2.15, 2.16, 2.21, 2B.1, 2B.13, 2B.14, 3.16, 4.17, 5.15, 5.18, 6.23, 6.31, 6.32                       |
| Missing precondition            | A unit, resource, or requirement the method assumed is not there | 1.10, 1.16–1.18, 2.8–2.10, 3.1–3.10, 4.1, 4.2, 4.4, 5.9, 5.17, 6.5, 6.6                                         |
| Target invalidated              | The objective's target vanished, moved, or lost its value        | 1.12, 2.1, 2.2, 2.5, 2.11, 2B.3, 2B.9, 4.5, 5.11, 6.1–6.3, 6.27, 6.28                                           |
| Surprise or missing information | The enemy differs from what was assumed, or is not known         | 1.5–1.7, 1.14, 1.15, 2.4, 2.18, 3.11, 3.12, 3.15, 6.4, 6.12–6.18, 6.22, 6.24, 6.34                              |
| Execution going badly           | The method under-performs                                        | 1.9, 1.11, 1.13, 2.3, 2.6, 2.7, 2.17, 4.6, 4.7, 4.11, 5.2, 6.26, 6.30                                           |
| Competing commitments           | Valuable activities need the same assets                         | 2.14, 2B.12, 3.14, 4.15, 4.16, 5.1, 5.8, 6.19, 6.20                                                             |
| Milestone early or late         | A goal is reached sooner or later than the plan assumed          | 2.8, 3.1, 3.2, 4.18, 5.5–5.7                                                                                    |

| Response                     | Time scale          | Examples                                                                                                              |
| ---------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Unit reflex or skill         | under a second      | Wisps flee, the Demon Hunter escapes with the Staff (2.12), dodge Blizzard (6.16), last hit (2.16)                    |
| Group tactic change          | seconds             | leave a camp when the Humans arrive (4.8), focus Priests (6.13), kill repairing Peasants (2B.5, 6.9)                  |
| Method change                | seconds to a minute | next creep camp (1.12, 4.5), another harassment target, recover then resume (2.7, 5.16), wait for a safe Tavern (3.4) |
| Reassignment                 | seconds             | the Demon Hunter leaves harassment to defend (2.14), the Ancient of War leaves production to creep (4.1)              |
| New or dropped commitment    | seconds             | raid a fresh expansion (1.4, 2B.1), revive a hero (1.11), attack early (1.20, 5.18)                                   |
| Strategy adaptation          | tens of seconds     | answer a tower rush (1.1), choose the second hero (3.11), add anti-air (6.17)                                         |
| Belief revision or inference | continuous          | camp seen cleared (1.12), enemy start eliminated (1.15), the Archmage teleported home (2.11)                          |

Triggers are open-ended; responses are not. Most scenarios are the same few questions answered again with new Beliefs: _is this still worth it_, _which target is best now_, _fight or flee_, _who should go_, _do I have what I need_. An architecture that asks each question continuously, at the right level and pace, handles unlisted scenarios by adding knowledge and rules, not mechanisms.

### 2.2 Requirements

- **R1 — Commitment with replaceable methods.** A purpose (harass the enemy hero, level the second hero, cripple the enemy economy) survives changes of target, route, method, and even units (2.1–2.21, 2B, 4.5, 6.1–6.3).
- **R2 — Interruption without loss.** A commitment interrupted for something more urgent keeps its progress and resumes cheaply; activities that are expensive to interrupt are protected (2.7, 2.14, 4.15, 5.1, 5.2).
- **R3 — One priority order for contested assets.** Heroes, units, production buildings, gold, lumber, food, and shop stock are wanted by several activities at once; one explicit order decides (2.14, 3.7–3.9, 3.14, 4.1, 6.19, 6.20).
- **R4 — Situations create Desires.** Threats and opportunities appear in what any unit sees, at any time, and must become candidate commitments without a dedicated watcher for each (1.1, 1.4, 1.8, 1.20, 2B.1, 5.15, 5.18, 6.32).
- **R5 — Bounded opportunism.** Units and groups exploit what they meet (a dying creep, an exposed Peasant, a wounded camp), but only as far as their purpose allows: a scout may chase workers, the Wisp travelling to the Tavern may not (2.15, 2.16, 2.21, 4.17).
- **R6 — Reflexes faster than deliberation.** Survival and fight micro react within a tick or two, whoever owns the unit (2.12, 4.10, 6.15, 6.16).
- **R7 — Group combat as a skill.** Fight or flight, focus fire, positioning, regrouping, and sacrificing cheap units are decided per group, with a shared view of the fight (1.9, 1.13, 4.6–4.14, 6.8–6.18, 6.30).
- **R8 — Unit- and hero-specific play.** Each unit type and hero has its own abilities and typical use. The same hero plays differently in different roles, such as the Demon Hunter as a harasser or in the front line, and units sometimes take unusual roles: the Ancient of War as a tank, Wisps detonating on summons.
- **R9 — Knowledge under uncertainty.** Decisions rely on remembered and inferred information with age and confidence: the enemy start, hero, tech, army, expansions, and hero whereabouts (1.5–1.7, 1.14, 1.15, 2.1, 2.17, 3.11, 3.15).
- **R10 — Space and time.** Routes, travel time, danger along routes, pathing limited by unit size, rendezvous points, and timing windows drive many choices (2B.11, 3.1, 4.4, 5.8, 6.21, 6.29).
- **R11 — Consistent mechanics.** Strength estimates, fight predictions, build and research times, militia duration, tech requirements, and experience rules are computed one way everywhere; otherwise a defense sized by one estimate meets an attack timed by another.
- **R12 — Strategy as an adaptable game plan.** Phases, milestones, hero and army choices, and adaptations to scouted information, not a script (all of scenario 1, 3.11, 6.17, 6.34).
- **R13 — Explainability.** For every decision it is possible to tell which Beliefs, Desire, priority, and rule produced it.

## 3. Where the current architecture falls short

| Requirement | Current implementation                                                                                                                                            | Current target design                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| R1, R2      | Plans are replaceable, but nothing models losing units to another commitment and getting them back                                                                | Lifecycle states (suspended, blocked) without a mechanism behind them                                               |
| R3          | Actor Control grants the first request; requests are only normal or preemptive; Plans and Controllers pick their own Actors; no gold, lumber, or food arbitration | Resource Arbitration, Unit Assignment, Intention Scheduling, and Command Arbitration as four overlapping systems    |
| R4          | Desires are permanent or expressed by Intentions; Deliberation maps each Desire kind to one Intention in code                                                     | "Desires generated directly from Beliefs" is planned                                                                |
| R5–R8       | No group or unit layer: every Plan and Controller issues Warcraft orders itself, so micro would be rewritten in every Intention                                   | Reactive Controllers and Command Arbitration; the unit level is unspecified                                         |
| R9          | The current observation, plus one second of attack memory                                                                                                         | Memory and inference are planned                                                                                    |
| R10, R11    | Start positions and the nearest gold mines; Assessments are private to each module                                                                                | Strategic navigation is planned; a shared assessment model is described but not reconciled with private Assessments |
| R12         | One strategy, the tower rush, as one large Intention with fixed steps                                                                                             | One strategy commitment chosen through AdaptStrategy                                                                |
| Timing      | Intentions throttle themselves with `UpdateInterval`                                                                                                              | The Central Timing Scheduler is planned                                                                             |

Most of what is missing is planned in the target design. The proposal below is mainly about turning those plans into a small set of mechanisms with non-overlapping responsibilities, and about adding the two layers the target design leaves vague: group tactics and per-unit behavior.

## 4. Proposed architecture

### 4.1 Overview

```text
KNOW      Warcraft ─▶ Perception ─▶ Beliefs ◀── Knowledge: game data, combat model, map, navigation
                                       │
WANT      standing desires ───┐        │
          strategy playbook ──┼─▶ Option Generation ─▶ Desires
          Intention requests ─┘
                                       │
COMMIT    Deliberation ─▶ Intentions in agenda order
                                       │
ALLOCATE  Allocation: needs served in agenda order ─▶ each Intention's force and budget
                                       │
ACT       Intention ─▶ Plan ─▶ Tactic ─▶ Directive ─▶ Unit Behavior ─▶ Warcraft order
```

Who decides what, extending the responsibility table of the target design:

| Decision                                                                  | Responsibility                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| What is observed, remembered, and inferred?                               | Perception and belief models                                           |
| How does the game work, how strong is a force, how long does a trip take? | Knowledge                                                              |
| What would be worth achieving?                                            | Standing desires, the playbook, Intention requests → Option Generation |
| What do we commit to, and in which order of importance?                   | Deliberation                                                           |
| Is my commitment still worthwhile, and what would interrupting it waste?  | The Intention's `assessCommitment`                                     |
| What does an Intention need right now?                                    | The Intention's `needs`                                                |
| Who gets which units and resources?                                       | Allocation                                                             |
| Which method and target, in which order?                                  | The Intention's Plan                                                   |
| Fight or flee, whom to focus, where to stand?                             | The Tactic steering the force                                          |
| What does this unit do this instant?                                      | Its Unit Behavior, within its Directive                                |
| Which Warcraft order is sent?                                             | The order executor behind Unit Behaviors                               |

### 4.2 Know: Beliefs and Knowledge

**Perception** becomes a module of its own: the only code reading Warcraft state for Beliefs. It produces observations of the bot's own units, visible enemy and neutral units, items on the ground, and events: attacks, deaths, spells cast by visible units, constructions started. Belief models revise from observations only, so the enemy model cannot accidentally read fogged units.

The Common Beliefs grow into sections:

| Section        | Contents                                                                                                                                                                                                                                                                                          | Kind              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Own            | Units by type, heroes (level, experience, mana, items, cooldowns), buildings and their production, upgrades, gold, lumber, food, Moon Well mana                                                                                                                                                   | current           |
| Enemy          | Units and structures last seen, with time and place; heroes (type, level, last seen life and mana, items seen); known bases                                                                                                                                                                       | retained          |
| Enemy inferred | Start location (candidates eliminated by scouting), likely expansions, army estimate (composition, strength, probable region), hero whereabouts, strategy hypotheses (tower rush, fast expansion, Tier 2 rush, mass Footmen, proxy) with confidence, threats against own assets, danger by region | inferred          |
| Neutral        | Creep camps (alive, wounded, cleared, last seen), items on the ground, shop and Tavern stock when seen                                                                                                                                                                                            | current, retained |
| Time           | Game time, day or night (creeps sleep at night)                                                                                                                                                                                                                                                   | current           |
| Self           | The adopted strategy, which Intention owns each unit                                                                                                                                                                                                                                              | self-knowledge    |

Inferred Beliefs carry confidence and age, so uncertainty stays uncertainty: "the enemy army is probably near the northern camps, estimated from a sighting 40 seconds ago" is a different Belief from "the enemy army is seen there".

**Knowledge** is a new layer of static, pure, shared code:

- **Game data**: units, heroes, abilities, items, upgrades, and creeps; costs, food, build and research times; damage and armor tables; tech requirements; experience rules; facts such as militia duration or creeps sleeping at night.
- **Models of mechanics**: the combat model (which of two forces wins a fight and what remains, towers and creeps included), damage per second against a target, when production completes, expected income.
- **Map knowledge and navigation**, see [4.9](#49-map-knowledge-and-navigation).

What is shared and what stays private:

- Mechanics belong to Knowledge, shared by everyone. Two deciders must never disagree on how strong a force is.
- Interpretations several components must agree on become inferred Beliefs, revised once: the threat at the main base is the same for the standing desire that wants it defended and for the Intention sizing the defense.
- Private judgments of one component, such as which camp suits this force or which target a tower should shoot, stay Assessments in that component's module, as today.

### 4.3 Want: Desires

Desires keep their meaning: outcomes worth pursuing, not yet commitments. They have three sources:

| Source           | Owner                          | Example Desires                                                                                                                                                                                  |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Standing desires | The bot itself, in `desires/`  | `DefendBase{base}` while it is threatened; `ReviveHero{hero}` while the hero is dead; `Scout{enemy start}` until it is known; `RunEconomy`, `MaintainSupply`, `MaintainEffectiveStrategy` always |
| Playbook         | The adopted strategy Intention | `TrainHero{Demon Hunter}`, `ProduceArmy{5 Archers}`, `Creep{…}`, `HarassEnemyHero{…}`, `RaidExpansion{base}`, `HireHero{slot 2}`, `ReachTech{Master Training}`, `Attack{…}`                      |
| Requests         | Any Intention                  | `AcquireItem{Demon Hunter, Staff of Teleportation}`, `ProtectUnit{Demon Hunter}`, `ClearCamp{camp at the expansion}`                                                                             |

A **standing desire** is a pure rule over Beliefs, evaluated by Option Generation; a permanent Desire is a standing desire whose situation always holds. Standing desires hold what any competent player wants whatever the game plan; the playbook holds what this game plan wants. Both have the same shape: Beliefs in, outcomes with importance and a reason out.

```ts
// desires/standing-desires.ts (sketch)
const defendThreatenedBases: StandingDesire = ({ beliefs }) =>
  beliefs.enemy.threats
    .filter((threat) => threat.against.kind === 'Base')
    .map((threat) => ({
      outcome: { kind: 'DefendBase', base: threat.against.base },
      importance: defenseImportance({ threat }),
      reason: `${threat.strength} enemy strength at ${threat.against.name}`,
    }));
```

A Desire ends when nothing supports it anymore: a rule whose situation no longer holds, a playbook phase that moved on, an Intention that withdrew its support. Satisfaction therefore needs no separate mechanism, as long as rules state their conditions.

**Granularity.** A target or sub-goal is a Desire of its own when it is worth considering independently of who pursues it, can compete with other commitments for assets, or should outlive the activity that noticed it. Otherwise it is an internal choice of an Intention's Plan or Tactic:

- A fresh Human expansion is a Desire, `RaidExpansion{base}`: the Demon Hunter, the army, or nobody may pursue it, and it competes with harassment and creeping.
- Which Peasant to kill first at that expansion is a choice of the raid's Tactic.
- The next camp of a creeping army is a choice of its Plan.
- A Staff of Teleportation for the Demon Hunter is a Desire, `AcquireItem`: it needs gold others want and may be supported by several Intentions.

**Importance** must mean the same everywhere, because the agenda compares importances from different sources. Bands give it meaning, and a Desire's importance is the maximum of its supports, so that several weak supports do not outweigh one critical support:

| Band        | Importance                   | Examples                                      |
| ----------- | ---------------------------- | --------------------------------------------- |
| Survival    | 0.9–1                        | the main base about to fall                   |
| Critical    | 0.75–0.9                     | base under attack, hero revival, supply block |
| Plan        | 0.5–0.75                     | the current phase's goals                     |
| Opportunity | 0.3–0.8, by value and window | raid an expansion, attack a weakened army     |
| Background  | 0.1–0.3                      | refresh scouting, extra creeping              |

Within a band, values come from estimates in a common currency where possible: the gold and lumber worth of assets saved, destroyed, or denied; experience converted to hero power; how long a window stays open. Calibrating them is the main tuning work ([risks](#10-risks-and-open-questions)).

### 4.4 Commit: Deliberation and Intentions

An Intention is an **operation**: a commitment, what it needs to progress, and a method. Its contract grows by one query and a richer commitment assessment:

```ts
// sketch
interface Intention {
  update({ beliefs, updateChild }): void; // as today
  // What it wants allocated now. Side-effect free, like assessCommitment.
  needs({ commonBeliefs }): Needs;
  assessCommitment({ commonBeliefs, desire }): Commitment;
}

interface Commitment {
  verdict: 'continue' | 'completed' | 'abandon';
  // What preempting it now would waste: an engagement under way, a purchase
  // about to happen, an Archer nearly trained.
  interruptionCost: number;
}
```

On each cycle Deliberation:

1. **Retains** the Intentions whose verdict is `continue` and drops the others, recording completion and abandonment separately.
2. **Adopts** an Intention for each sufficiently important Desire that has none, through a registry from outcome kind to assemble function, honoring exclusive groups such as "one strategy at a time".
3. **Orders** them into the **agenda**: priority is the Desire's importance, plus a commitment bonus for being active, plus the interruption cost. A challenger must beat an incumbent by a margin to displace it, which prevents oscillation.

Deliberation stays the only place weighing commitments against each other; Intentions judge only themselves.

The lifecycle needs no extra states. An Intention on the agenda without the units it needs is **starved**; that is what "suspended" means in Warcraft, and diagnostics show which Intention took its units. "Blocked" is an Intention whose Plan cannot progress, which it reports through its verdict or waits out. Completed and abandoned Intentions leave the agenda.

Intention types the scenarios need:

| Intention                       | Adopted for                 | Needs                                                   | Method                                                                     |
| ------------------------------- | --------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| RunEconomy                      | permanent                   | workers not needed elsewhere, the main hall for workers | distribute workers, train workers, replace losses                          |
| MaintainSupply                  | permanent                   | a builder and money when needed                         | predict food including reservations, build ahead, rebuild                  |
| Reserve                         | permanent                   | military units nobody else asked for                    | gather at a rally point near defenses                                      |
| AdaptStrategy                   | `MaintainEffectiveStrategy` | nothing                                                 | prefer a strategy and support executing it, as today                       |
| Strategy, such as FastBears     | `Execute…Strategy`          | nothing                                                 | its playbook expresses Desires; it orders no units                         |
| ReachTech                       | playbook                    | builders, producers, money                              | follow the tech requirements with Construct, Research, and Upgrade plans   |
| ProduceArmy                     | playbook                    | producers, money, food                                  | train toward a composition, rebuild producers                              |
| TrainHero, HireHero, ReviveHero | playbook, standing desire   | the Altar or a Tavern visitor, money, food              | Train or Hire plan, timed to readiness                                     |
| AcquireItem                     | requests, playbook          | the hero, money                                         | Purchase plan                                                              |
| Scout                           | standing desire, playbook   | one cheap mobile unit                                   | visit candidates by likelihood, evade, retry                               |
| Creep                           | playbook                    | heroes to level and army strength suited to the camps   | choose camps, Travel, CreepCamp, Recover                                   |
| HarassEnemyHero, RaidExpansion  | playbook                    | a mobile hero or units                                  | search, HitAndRun or Siege, Recover                                        |
| DefendBase                      | standing desire             | strength above the threat, arriving in time             | Hold near defenses and Moon Wells, Skirmish, Town Portal or Staff when far |
| ProtectUnit                     | requests                    | units able to reach the unit in time                    | Travel, Skirmish                                                           |
| Attack                          | playbook                    | an army above a minimum strength                        | choose the target, Travel, Siege, Skirmish, retreat when lost              |
| Expand, ClearCamp               | playbook, requests          | a builder, money, an army to clear the site             | clear, build, transfer workers                                             |

One Intention pursues one Desire. An operation that needs coordinated groups, such as an attack pinning the enemy army while the Demon Hunter hits the workers, declares two needs and steers each group with its own Tactic, rather than splitting into Intentions that would have to coordinate.

### 4.5 Allocate: needs, forces, and budgets

An Intention's needs say what it wants, not whom it takes:

```ts
// sketch
interface Needs {
  units: readonly UnitNeed[];
  resources?: { gold: number; lumber: number; food: number };
}

interface UnitNeed {
  match: UnitMatch; // a given unit, unit types, or a class such as army or worker
  count?: { min: number; max: number };
  strength?: { min: number; enough: number }; // combat strength, from Knowledge
  prefer?: { near: Point; arrivingWithin?: number };
}
```

On each allocation round:

1. Allocation walks the agenda from the top. For each need it picks among the units not yet taken this round, preferring units the Intention already has, then by the need's preferences, such as the shortest travel time.
2. Units held by an Intention lower on the agenda are available. Whether preempting it is worthwhile was already decided by the agenda, whose priorities include interruption costs and displacement margins.
3. A need whose minimum cannot be met gets nothing, so units are not wasted on a force too weak to act.
4. Gold, lumber, and food are reserved in the same order; lower Intentions see what remains. Reserving money that does not exist yet is saving: HireHero reserving the hero's price as Tier 2 nears stops cheaper spending in time.
5. Units nobody asked for go to their default owner: workers to RunEconomy, military units and heroes to Reserve.

An Intention's **force** is the units allocated to it and its **budget** the resources reserved for it. It reads and directs both through a **Force** capability, which replaces actor control: like the arbiter today, it acts for the Intention whose update is running, and directing a unit outside the Intention's force throws.

The useful property of leases survives: needs are declared again every round, so an Intention dropped, or no longer needing a unit, loses it without releasing anything. Production buildings are units too: the Ancient of War belongs to ProduceArmy while it trains Archers and to Creep while it tanks (4.1), never to both.

### 4.6 Act: Plans, Tactics, Directives, and Unit Behaviors

```text
Intention        Harass the Archmage with the Demon Hunter            importance 0.6
  Plan           search → engage → disengage → recover → search
    Tactic       hit and run around the Archmage                      leash 800, chase at most 3 s
      Directive  Demon Hunter: Engage(Archmage), role Harasser, retreat at 45 % life
        Unit Behavior (Demon Hunter)
          reflexes        escape when trapped (Staff) · retreat when low
          skills          Mana Burn · Immolation
          opportunities   last hit · finish a dying unit in range
          task            attack and reposition as directed
```

**Plans** remain finite methods with a status. Most are small explicit state machines that choose targets and steps, run Tactics, read their outcomes, and replan when a step fails. Execution monitoring is part of every Plan's update rather than a system of its own. Reusable Plans cover production: Construct, Train, Research, Purchase, Hire.

**Tactics** are Controllers steering a group, reusable by every Intention:

| Tactic    | Purpose                                                                     |
| --------- | --------------------------------------------------------------------------- |
| Travel    | Move a group along a route, keep it together, bring joining units in safely |
| Skirmish  | Fight enemy units                                                           |
| CreepCamp | Pull, fight, last-hit, and loot a camp without waking others                |
| HitAndRun | Harass a target without a decisive engagement                               |
| Siege     | Attack structures defended by towers, repairers, and militia                |
| Hold      | Defend a place, using Moon Wells and static defenses                        |
| Recover   | Heal and restore mana at Moon Wells, fountains, or with items               |

Every Tactic that can meet enemies uses the same fight evaluation from the combat model, so an enemy appearing while creeping, travelling, or sieging is handled the same way. Each update it re-evaluates fight or flight against the latitude its Plan gave it and reports its outcome (ongoing, won, lost, retreated) for the Plan. It decides group matters: focus fire without overkill, kill order (healers, casters, summons, repairing Peasants), positioning (ranged units behind the front, spread against area damage), which units may sacrifice themselves, and local opportunities. It expresses all of this as Directives.

A **Directive** is what a unit is asked to do:

```ts
// sketch
interface Directive {
  task: Task; // Move, Engage, Hold, Harvest, Build, Repair, Produce, UseItem, Purchase, PickUp…
  role?: Role; // how to play it: Harasser, Tank, Damage, Support, Scout, Bait
  latitude: Latitude;
}

interface Latitude {
  retreatAtLife: number; // 0 for an expendable unit that fights to the end
  opportunism: 'none' | 'local' | 'free';
  leash?: { anchor: Point; radius: number };
}
```

One-shot tasks such as building, producing, purchasing, or using an item report success or failure with a reason, so Plans can react to a rejected placement or an empty shop.

A **Unit Behavior** belongs to each own unit, buildings included, for the unit's lifetime. It is chosen by unit type and owned by the runtime, not by Intentions. Each tick it chooses one action by trying, in order:

1. **Reflexes**, whoever owns the unit: flee when about to die unless the Directive makes it expendable, escape when trapped (Staff of Teleportation, potion, the weakest gap), dodge area damage, cancel a construction about to be destroyed, eat a tree.
2. **Skills**, the abilities and items of its type, used as its role suggests: Mana Burn, Immolation, Frost Arrows, Roar, Rejuvenation, Abolish Magic, Detonate on summons.
3. **Opportunities**, if its latitude allows: last hit, finish a dying unit in range, pick up an item nearby.
4. **The task**, with the technique of its type, such as kiting for ranged units or attack timing.

```ts
// units/demon-hunter.ts (sketch)
const demonHunter = composeUnitBehavior({
  reflexes: [escapeWhenTrapped, retreatWhenLow],
  skills: [manaBurn, immolation, metamorphosis],
  opportunities: [lastHit, finishDyingInRange],
});
```

Shared modules such as `retreatWhenLow`, `lastHit`, or `kiteMelee` make a new unit type mostly a composition. Hero skill and item builds are playbook data the hero's Unit Behavior follows when it levels up. The role in the Directive selects alternative play: the Demon Hunter burns the enemy hero's mana as a Harasser and the casters' as Damage; Wisps harvest by default and detonate on Water Elementals when a defense directs them to.

A choice belongs to the unit when it needs only that unit's situation, and to the Tactic when it needs the group's view: who else attacks that target, or whether the fight is being won.

Unit Behaviors are the only code ordering units. Behind them an **order executor** issues a Warcraft order only when it differs from what the unit is already doing (re-issuing an attack restarts it, which the current tower targeting already works around), and records why each order was issued. Scripts cannot queue orders, so multi-step tasks are driven by the Unit Behavior tick by tick. The order executor realizes the Actions boundary and is the one place to replace in tests.

Existing behaviors map directly: worker safety becomes the worker reflex, and tower target selection becomes the Guard Tower's task.

### 4.7 Opportunities and latitude

| Level      | Examples                                                                                                    | Decided by                  | Bounded by                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------ |
| Unit       | Last hit (2.16), finish a dying unit in range (2.15), pick up a dropped item, Mana Burn a passing caster    | Unit Behavior opportunities | The Directive's latitude                   |
| Group      | Finish a camp the Humans left wounded (2.21), kill exposed workers on the way, chase a fleeing hero briefly | The Tactic                  | The leash, time, and risk its Plan gave it |
| Operation  | Switch the harassment to a worker line, take a mercenary camp on the route (4.17)                           | The Intention's Plan        | The Intention's goal                       |
| Commitment | Raid a fresh expansion (1.4, 2B.1), attack because the enemy army died (1.20, 5.18)                         | A Desire, then Deliberation | Importance against the agenda              |

Every level evaluates an opportunity the same way: its value, minus the detour, the risk, and the value of what is interrupted, must exceed a threshold, within the latitude given. Values come from Knowledge: unit worth, experience, item worth.

Latitude is how the upper levels keep lower ones focused. A scout's Directive carries `opportunism: 'free'`, so it may chase a lone Peasant; the Wisp travelling to the Tavern carries `'none'` and a deadline. A decisive fight sets `retreatAtLife: 0` for cheap units whose damage is needed, while heroes keep a high threshold.

Nothing reports opportunities upward. Whatever any unit sees enters the Beliefs, and standing desires and the playbook, evaluated over all Beliefs, turn what matters into Desires. Intentions only request what is specific to them, such as help or an item.

### 4.8 Strategies as playbooks

A strategy Intention has phases and desire rules. It expresses Desires and orders no units. AdaptStrategy keeps choosing among strategies as today.

The Fast Bears playbook for Night Elf versus Human:

| Phase       | Entered when                                          | Desires it expresses                                                                                                                                                               |
| ----------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening     | the game starts                                       | `TrainHero{Demon Hunter}`, `ProduceArmy{5 Archers}`, the opening buildings, `Scout{enemy start, then hero and tech}`, `Creep{Demon Hunter with the Ancient of War, until level 2}` |
| Harass      | the Demon Hunter reaches level 2                      | `AcquireItem{Demon Hunter, Staff}`, `HarassEnemyHero{main hero}` once the Staff is held, `ReachTech{Tier 2}`                                                                       |
| Second hero | Tier 2 is being researched                            | `HireHero{slot 2: Naga or Brewmaster}`, `Creep{second hero, Archers, Ancient of War, until about level 2.5}`                                                                       |
| Reunite     | the second hero reaches about level 2 to 2.5          | `Creep{both heroes and the army, toward level 3}`, `ReachTech{Master Training}`, `ProduceArmy{Druids of the Claw}`                                                                 |
| Bear timing | Master Training is done and the army is strong enough | `Attack{most valuable vulnerable enemy base}`, `ProduceArmy{reinforcements}`                                                                                                       |

Adaptations are rules on inferred Beliefs that change importances and add or withdraw Desires:

| Enemy hypothesis or event              | Adaptation                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Tower rush (1.1)                       | Tier 2 later, units and defensive structures earlier, no harassment                      |
| Fast expansion (1.4)                   | `RaidExpansion` important; consider an earlier timing                                    |
| Tier 2 rush, mass Footmen (1.5, 1.6)   | Harassment less important so the Demon Hunter stays near home; more defensive production |
| Composition observed (3.11, 3.12)      | Second-hero preference                                                                   |
| Enemy army weakened (1.20, 5.18, 6.23) | `Attack` early, its importance decaying as the enemy rebuilds                            |
| Flying army (6.17)                     | Anti-air composition                                                                     |

Choices are made at the last responsible moment. The playbook expresses `HireHero{slot 2}` with its candidates, and the hero is chosen when it is hired, against the composition estimate of that moment. An Attack names its objective, and the Attack's Plan picks the actual base when it gets there.

### 4.9 Map knowledge and navigation

Map knowledge is prepared when the map is built and embedded with the bundle; the bot only reads it. It needs:

- regions and the chokes between them, with widths, and pathing per unit size class, so the Ancient of War's routes are known (4.4);
- distances or routes between important places;
- start locations and expansion sites, with their gold mines and tree lines;
- creep camps: creeps, levels, item drop class, extent, and which camps wake together;
- shops, Taverns, mercenary camps, fountains, and other neutral buildings.

All of it is what a player knows from the map, so reading it is fair.

Navigation, part of Knowledge, plans routes over the region graph with costs that depend on the traveller and the current Beliefs: danger by region from the enemy model, known towers (2.19), size class. A small reinforcement group avoids a corridor the main army may choose because it intends to fight there. It also answers travel time, which Allocation, Plans, and the playbook use: whether the Demon Hunter can defend in time, when the Tavern Wisp must leave.

### 4.10 Timing

The Central Timing Scheduler becomes necessary: decisions run at different paces, and Intentions stop throttling themselves.

| What                               | Pace       | Earlier on                                        |
| ---------------------------------- | ---------- | ------------------------------------------------- |
| Perception and fast Beliefs        | every tick |                                                   |
| Unit Behaviors                     | every tick |                                                   |
| Tactics                            | 0.2–0.3 s  | enemies appearing near the group                  |
| Intentions and Plans               | 0.5–1 s    | a Tactic's outcome, a unit lost                   |
| Allocation                         | 1 s        | agenda changes, new units, an unmet critical need |
| Option Generation and Deliberation | 1 s        | a new threat                                      |
| Slow inference (estimates, danger) | 1–2 s      |                                                   |
| Strategy reassessment              | 5–10 s     | a hero dying, a base lost                         |

The tick may need to be shorter than 100 ms for fine micro such as kiting; that is a measurement, not a design question.

### 4.11 Diagnostics and testing

Every decision carries its reason: a standing desire or playbook rule its condition, the agenda each priority's parts, Allocation which need won a unit, a Directive its issuer, a Unit Behavior the module that chose the action, the order executor the Directive behind an order. In debug mode this gives the decision trace the target design asks for: from an order back to the reflex or Directive, the Tactic, the Plan, the Intention, its rank on the agenda, the Desire, and the Beliefs behind it.

Almost everything becomes a pure function of Beliefs: standing desires, playbooks, Deliberation, Allocation, the combat model, Tactics' choices, and Unit Behaviors' choices. Only Perception and the order executor touch Warcraft, which is what decision-level tests need once a test framework is introduced.

### 4.12 Why nothing here can be removed

- Without Desires separate from Intentions, every attractive opportunity becomes behavior at once, and threats and opportunities have no common place to be compared.
- Without the agenda, conflicts between commitments are decided by update order, as with Actor Control today.
- Without Allocation, each Intention picks its own units, and interruption and resumption become a protocol between Intentions.
- Without Plans, multi-step methods hide inside Tactics as flags.
- Without Tactics, every operation reimplements fighting; without Unit Behaviors, every Tactic reimplements every unit's micro and reflexes.
- Without shared Knowledge and inferred Beliefs, the deciders disagree about the same facts.

What was removed answered questions the remaining parts already answer: Actor Control and Unit Assignment (Allocation), Intention Scheduling (agenda and Allocation), Command Arbitration (each Unit Behavior is the single decision point for its unit), and execution roles (Directives).

## 5. Walkthroughs

### 5.1 The Demon Hunter's harassment, interrupted twice

Scenarios 2, 2B.1, 2.14, and 2B.9.

1. In its Harass phase the playbook expresses `HarassEnemyHero{Archmage}` at 0.6. Deliberation adopts it; its needs ask for the Demon Hunter; Allocation takes him from Creep, which ranks lower in this phase.
2. Its Plan searches where the Archmage was last seen and where camps found cleared suggest his route. The Travel Tactic moves the Demon Hunter with local opportunism, so a camp left wounded on the way may be finished (2.21).
3. On contact the HitAndRun Tactic directs the Demon Hunter to engage the Archmage as a Harasser, retreating at 45 % life. His Unit Behavior burns mana while the Archmage has enough to lose and escapes with the Staff if trapped.
4. The scouting Wisp sees a Town Hall under construction. Perception adds a retained enemy base and inference a fast-expansion hypothesis; the playbook expresses `RaidExpansion{north}` at 0.75.
5. Deliberation adopts the raid. On the agenda, 0.75 beats the harassment's 0.6 plus its 0.1 interruption cost for the engagement under way, so Allocation moves the Demon Hunter. The harassment keeps its memory of the Archmage but has no force.
6. The raid's Siege Tactic ranks the building Peasant above the Hall; the Demon Hunter kills it.
7. Footmen reach the Night Elf Wisps. The Wisps flee by reflex at once. The standing desire `DefendBase{main}` appears at 0.85; its needs ask for strength above the threat arriving within 20 seconds: the Archers and the Ancient of War at home, and the Demon Hunter, because his Staff is ready. Allocation gives him to the defense.
8. The defense's Plan has him use the Staff, and its Hold Tactic fights by the Moon Wells, focusing the Footmen.
9. With the Footmen dead the threat leaves the Beliefs, the standing desire ends, and DefendBase completes. The Peasants have evacuated the expansion, so the raid's Desire retires (2B.9). The Demon Hunter returns to the harassment, which resumes from its memory.

No Intention told another anything: every switch came from Beliefs, Desires, the agenda, and Allocation.

### 5.2 Buying the second hero

Scenario 3.

1. When Tier 2 research starts, the playbook enters its Second hero phase and expresses `HireHero{slot 2}` at 0.8, with Naga and the Brewmaster as candidates.
2. HireHero needs nothing until the predicted Tier 2 completion, from Knowledge and the Beliefs, minus the Wisp's travel time from navigation and a margin. Then it asks for one Wisp, which Allocation takes from RunEconomy (3.1, 3.2).
3. Slightly before completion it reserves the hero's gold and food, so cheaper spending stops in time (3.7) and MaintainSupply builds for the reserved food (3.9).
4. The Wisp travels a safe route with no opportunism. If it dies, the need is unmet again and Allocation sends another (3.3). At the Tavern the Plan waits at a safe distance while enemies are near (3.4).
5. At hire time the playbook's rule chooses against the latest composition estimate (3.11, 3.12), falling back to the other candidate if the Tavern's stock shows the preferred one is gone (3.5, 3.6).
6. The new hero is a new unit. The next round gives it to the highest Intention asking for heroes: Creep normally, DefendBase if the base is attacked (3.13), a raid if an expansion lies exposed (3.16).

### 5.3 A creep fight interrupted by the Human army

Scenario 4.8.

1. Creep's Plan engages a camp with the CreepCamp Tactic: the Ancient of War in front as a Tank, Archers behind, Naga slowing with Frost Arrows, the camp's healer focused first.
2. The Archmage, Footmen, and a Water Elemental appear. The Tactic re-evaluates the fight with both sides and the remaining creeps: it is lost unless the last creep dies within seconds.
3. It sends two Archers with local latitude to finish the creep and directs everyone else back along a route away from the Humans, Naga first, past the spot where the creep's item will drop.
4. The Archers kite the chasing Footmen and, since Defend weakens their piercing attacks, prefer the Water Elemental. Naga's Frost Arrows slow the pursuers; her reflex steps behind the Ancient when she is focused, and she picks up the dropped item as an opportunity within her retreat's leash.
5. The Tactic reports that it retreated. The Plan marks the camp contested and picks one away from the Human army.

## 6. Scenario coverage

### Scenario 1: default opening

| #    | Handled by                                                                                                                                                                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | Perception sees Peasants and towers near the base; inference raises the tower-rush hypothesis. DefendBase outranks creeping, so Allocation takes the Demon Hunter and the Archers from creeping and the Ancient of War from production; the Siege Tactic kills builders and unfinished towers first. The playbook adapts its build. |
| 1.2  | DefendBase sized by the threat, militia included; the Hold Tactic fights by the Moon Wells; Wisps flee by reflex; the militia duration from Knowledge lets the Tactic delay the fight.                                                                                                                                              |
| 1.3  | Wisps flee by reflex. DefendBase's importance follows the Wisps at risk, and its needs ask only for units arriving in time; the Staff makes even the distant Demon Hunter one of them. RunEconomy moves Wisps to safer trees and replaces losses.                                                                                   |
| 1.4  | The sighting becomes a retained enemy base and a fast-expansion hypothesis; the playbook expresses `RaidExpansion`; the agenda decides whether the Demon Hunter leaves his current activity.                                                                                                                                        |
| 1.5  | Inference from the Keep's timing; the playbook raises defensive production and shifts the second-hero preference.                                                                                                                                                                                                                   |
| 1.6  | Inference from Barracks and Footman counts; the playbook lowers harassment so the Demon Hunter stays near home and adds defensive production.                                                                                                                                                                                       |
| 1.7  | The enemy hero type enters the Beliefs; the playbook changes harassment's importance and the combat model changes creeping risk.                                                                                                                                                                                                    |
| 1.8  | Enemy production structures far from the enemy base: inference of a proxy; DefendBase covers enemy structures near own bases; the playbook adapts.                                                                                                                                                                                  |
| 1.9  | The CreepCamp Tactic re-evaluates the fight and retreats or pulls again; the Demon Hunter retreats by reflex; the Ancient eats a tree; the Plan prefers easier camps.                                                                                                                                                               |
| 1.10 | ProduceArmy lacks a producer and constructs a new Ancient; Creep's Plan adapts to the weaker force; the playbook may reorder the opening.                                                                                                                                                                                           |
| 1.11 | The standing desire `ReviveHero`; Allocation reserves gold and the Altar; Intentions that needed the hero are starved or abandon; the playbook turns defensive until he is back.                                                                                                                                                    |
| 1.12 | The camp seen cleared updates the neutral Beliefs and the enemy hero's estimated whereabouts; the Plan picks the next camp.                                                                                                                                                                                                         |
| 1.13 | The CreepCamp Tactic evaluates creeps and the Human army together; last hits and the item drop are opportunities; it retreats if the fight is lost.                                                                                                                                                                                 |
| 1.14 | The `Scout` Desire stays unsatisfied, so Allocation sends another Wisp if the importance is worth it; meanwhile decisions use priors and uncertain Beliefs.                                                                                                                                                                         |
| 1.15 | Start candidates are eliminated as they are seen empty; the Scout Plan visits the next most likely one; elimination can confirm the last remaining one.                                                                                                                                                                             |
| 1.16 | RunEconomy rebalances and trains Wisps; Allocation keeps serving the top priorities first; the playbook's phase conditions slip with the economy.                                                                                                                                                                                   |
| 1.17 | MaintainSupply predicts food from production and reservations, builds ahead, and rebuilds; Moon Well mana is a Belief the Recover Tactic weighs.                                                                                                                                                                                    |
| 1.18 | ReachTech follows the tech requirements and constructs again; the Construct Plan waits for a safe site.                                                                                                                                                                                                                             |
| 1.19 | DefendBase's importance includes structures under construction; a building's reflex cancels a construction about to be destroyed.                                                                                                                                                                                                   |
| 1.20 | Observed deaths lower the enemy army estimate; the playbook expresses `Attack`, its importance decaying as the enemy rebuilds.                                                                                                                                                                                                      |

### Scenario 2: Demon Hunter harassment

| #    | Handled by                                                                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | The hero whereabouts estimate (last sighting, camps found cleared, typical routes); the Plan searches likely places, opportunistically.                                                     |
| 2.2  | The Plan finds no reachable target and the verdict becomes `abandon`; the Demon Hunter returns to creeping by Allocation.                                                                   |
| 2.3  | The HitAndRun Tactic with the combat model and an escape route; Mana Burn from range.                                                                                                       |
| 2.4  | The playbook lowers harassment as the Archmage's level rises.                                                                                                                               |
| 2.5  | The Mana Burn skill scores low against an empty pool; the Tactic weighs killing the Archmage or the Water Elemental instead.                                                                |
| 2.6  | Skills are unavailable; opportunities and the Tactic turn to unit kills and creep steals.                                                                                                   |
| 2.7  | The retreat reflex, then the Plan's recover step at a Moon Well, a fountain, or with potions; the harassment resumes.                                                                       |
| 2.8  | The playbook's condition, the Demon Hunter at level 2, does not hold, so there is no harassment Desire yet.                                                                                 |
| 2.9  | Shop stock in the Beliefs; AcquireItem waits or settles for another item; without an escape item the harassment's latitude allows less risk.                                                |
| 2.10 | The Purchase Plan waits while the shop is dangerous, or uses another shop.                                                                                                                  |
| 2.11 | Seen casting Town Portal, the Archmage is believed home; the Tactic loses its target and the Plan retargets.                                                                                |
| 2.12 | The Demon Hunter's `escapeWhenTrapped` reflex: Staff, potion, or the weakest gap.                                                                                                           |
| 2.13 | Continuous fight evaluation; disengage.                                                                                                                                                     |
| 2.14 | DefendBase against the harassment and its interruption cost, on one agenda; the Staff makes the Demon Hunter useful in time. The playbook may answer with a raid on the enemy main instead. |
| 2.15 | An opportunity of the Tactic or the Unit Behavior, within the leash.                                                                                                                        |
| 2.16 | Last-hit and deny timing in the Unit Behavior; the Tactic keeps the Demon Hunter by the dying creep.                                                                                        |
| 2.17 | Danger includes where the enemy army probably is in the fog; the chase leash and the risk latitude stop pursuit into traps.                                                                 |
| 2.18 | The new hero raises the combat model's risk; the playbook lowers harassment.                                                                                                                |
| 2.19 | Known towers raise route danger; navigation and Tactics keep the mana-dependent hero out of their range.                                                                                    |
| 2.20 | The Plan cycles search, engage, recover; the whereabouts estimate updates when the Archmage reappears.                                                                                      |
| 2.21 | The wounded camp is in the Beliefs; finishing it is an opportunity for the Plan or the Tactic.                                                                                              |

### Scenario 2B: harassing the Human expansion

| #     | Handled by                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2B.1  | `RaidExpansion` is important for a Hall under construction; Allocation moves the Demon Hunter from the harassment; the Tactic kills the builder. |
| 2B.2  | The Tactic kills Peasants and ignores the Hall.                                                                                                  |
| 2B.3  | Low importance: no raid, or the raid abandons.                                                                                                   |
| 2B.4  | The Tactic kills tower builders, or leaves before the towers finish, using their completion time from Knowledge.                                 |
| 2B.5  | Repairing Peasants rise in the kill order.                                                                                                       |
| 2B.6  | Disengage, and come back after the militia expire.                                                                                               |
| 2B.7  | The Archmage seen coming or teleporting: the Tactic leaves before he arrives; the raid's importance drops.                                       |
| 2B.8  | The raid continues while the fight evaluation allows.                                                                                            |
| 2B.9  | The Desire retires and the raid completes; the Demon Hunter returns to the harassment, which resumes.                                            |
| 2B.10 | A second `RaidExpansion` Desire; the agenda decides which one gets the Demon Hunter.                                                             |
| 2B.11 | Travel time lowers the raid's value; navigation picks the route.                                                                                 |
| 2B.12 | DefendBase competes on the agenda.                                                                                                               |
| 2B.13 | The playbook expresses a raid on the enemy main while its army is away.                                                                          |
| 2B.14 | The fight evaluation counts the creeps against the enemy: strike while they fight the camp.                                                      |

### Scenario 3: the second hero

| #          | Handled by                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| 3.1, 3.2   | HireHero sends its Wisp by the predicted Tier 2 completion minus travel time; early, it waits safely. |
| 3.3        | The need is unmet again; Allocation provides another unit.                                            |
| 3.4        | The Plan waits at a safe distance, weighing the hero's importance against the risk.                   |
| 3.5, 3.6   | Tavern stock in the Beliefs; the other candidate, or waiting for restock.                             |
| 3.7        | Gold reserved in agenda order: hiring against defensive production.                                   |
| 3.8        | Lumber reserved for the higher-priority tech; the playbook's importances decide the sequence.         |
| 3.9        | MaintainSupply counts the reserved hero food and builds ahead.                                        |
| 3.10       | The hire's requirement, the Altar, from Knowledge; the Construct Plan.                                |
| 3.11, 3.12 | The hero is chosen at hire time by the playbook's rule against the composition estimate.              |
| 3.13       | The new hero is unassigned; DefendBase's needs claim it before Creep's.                               |
| 3.14       | `ReviveHero` and `HireHero` compete for gold by importance.                                           |
| 3.15       | The playbook adapts the army and items; the hire is not undone.                                       |
| 3.16       | `RaidExpansion` may claim the new hero.                                                               |

### Scenario 4: the second hero creeps with the Archers

| #        | Handled by                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1      | The Archer in training is ProduceArmy's interruption cost; Creep's Plan gathers and leaves when the Ancient is released.                    |
| 4.2      | The Plan leaves the Ancient behind or heals it by eating trees first.                                                                       |
| 4.3      | The Travel Tactic keeps the group together; the fight evaluation on contact.                                                                |
| 4.4      | Navigation by unit size class; camp choice excludes camps the Ancient cannot reach, or leaves it behind.                                    |
| 4.5      | The Plan picks the next camp.                                                                                                               |
| 4.6, 4.7 | The CreepCamp Tactic's fight evaluation and pulling; retreat.                                                                               |
| 4.8, 4.9 | Fight evaluation with creeps as a third party: contest, finish the camp quickly, or leave; last hits and the item drop as opportunities.    |
| 4.10     | The hero's reflex pulls back; the Tactic turns on the attackers or covers the hero.                                                         |
| 4.11     | The weaker force leads the Plan to easier camps; the playbook may lower creeping.                                                           |
| 4.12     | Unit target scoring knows Defend's piercing reduction; the Tactic focuses heroes and units not defending; Naga's magic damage matters more. |
| 4.13     | The kill order weighs summons.                                                                                                              |
| 4.14     | Fight evaluation and positioning; Archers kite or retreat.                                                                                  |
| 4.15     | DefendBase.                                                                                                                                 |
| 4.16     | The harassment requests `ProtectUnit{Demon Hunter}`, which may take the army on the agenda.                                                 |
| 4.17     | Camp choice values mercenary camps and item drops; the playbook may want mercenaries.                                                       |
| 4.18     | Creep completes; the playbook enters its next phase.                                                                                        |

### Scenario 5: joint creeping

| #        | Handled by                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| 5.1      | The harassment's interruption cost keeps the Demon Hunter until its engagement ends.                               |
| 5.2      | Reflexes work whoever owns the Demon Hunter; Creep treats him as joining; `ProtectUnit` may bring the army to him. |
| 5.3, 5.4 | `ReviveHero`; Creep's needs follow the heroes alive.                                                               |
| 5.5–5.7  | Creep's parameters say which heroes to level; its Tactic keeps the others out of experience range when it matters. |
| 5.8      | The Plan picks a rendezvous camp between the groups.                                                               |
| 5.9      | Travel on foot; travel time keeps the Demon Hunter where he is useful meanwhile.                                   |
| 5.10     | Each force's Tactic evaluates its fight; `ProtectUnit`.                                                            |
| 5.11     | No camps left: Creep completes or abandons; the playbook moves on.                                                 |
| 5.12     | Camp risk from the combat model and the danger estimate.                                                           |
| 5.13     | The contest is decided by the fight evaluation.                                                                    |
| 5.14     | DefendBase.                                                                                                        |
| 5.15     | `RaidExpansion`.                                                                                                   |
| 5.16     | The Plan's recover step.                                                                                           |
| 5.17     | Moon Well mana in the Beliefs; the Recover Tactic chooses fountains, potions, or waiting.                          |
| 5.18     | `Attack` from the playbook's adaptation to a weakened enemy.                                                       |

### Scenario 6: the Bear timing

| #          | Handled by                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| 6.1–6.4    | The playbook expresses the objective; the Attack Plan picks among known and inferred enemy bases by value. |
| 6.5        | The timing condition is army strength from the combat model, not the upgrade alone.                        |
| 6.6        | ProduceArmy rebuilds the Ancients of Lore; the playbook may delay the timing.                              |
| 6.7        | DefendBase.                                                                                                |
| 6.8–6.10   | The Siege Tactic's kill order (repairers, militia timing) and a fight evaluation that includes towers.     |
| 6.11       | Town Portal seen or the army arriving: fight evaluation; the Plan may withdraw and strike elsewhere.       |
| 6.12       | The Abolish Magic skill on slowed Bears; the Tactic focuses Sorceresses.                                   |
| 6.13       | Healers rise in the kill order.                                                                            |
| 6.14       | The skill policy avoids buffs near Spell Breakers; the kill order.                                         |
| 6.15       | Hero reflexes keep distance from the Mountain King when low; the Tactic focuses him.                       |
| 6.16       | The reflex dodges Blizzard; the Tactic spreads the army.                                                   |
| 6.17       | The playbook adapts the composition for anti-air; the Attack retargets structures.                         |
| 6.18       | Siege units behind the front rise in the kill order.                                                       |
| 6.19, 6.20 | DefendBase against the Attack and its interruption cost, and a raid on the enemy main, on one agenda.      |
| 6.21       | Tactics use chokes from map knowledge to choose where to fight.                                            |
| 6.22, 6.23 | The fight evaluation feeds the playbook's timing rule and the Attack's commitment assessment.              |
| 6.24       | Tactics re-evaluate continuously; the playbook adapts the composition.                                     |
| 6.25, 6.26 | The Attack Plan re-checks viability before engaging and abandons if it fails.                              |
| 6.27, 6.28 | Base value in the Beliefs: estimated gold left, workers seen.                                              |
| 6.29       | Reinforcements join through the Travel Tactic, in groups and on safe routes.                               |
| 6.30       | The Tactic retreats; the verdict becomes `abandon`.                                                        |
| 6.31       | The Plan presses on; the playbook's adaptation to a weakened enemy.                                        |
| 6.32       | The Plan retargets, or a raid Desire appears.                                                              |
| 6.33       | DefendBase.                                                                                                |
| 6.34       | AdaptStrategy reassesses the strategy.                                                                     |

## 7. Where a new behavior goes

| Behavior to add                                                                    | Home                               |
| ---------------------------------------------------------------------------------- | ---------------------------------- |
| Use of an ability or item by a unit type, such as Naga's Mana Shield when focused  | That type's Unit Behavior skills   |
| Survival and safety of a unit, such as worker flight or hero escape                | Unit Behavior reflexes             |
| A small gain one unit can take alone, such as a last hit                           | Unit Behavior opportunities        |
| Coordination of a group in a fight: focus fire, spreading, kill order              | A Tactic                           |
| A local gain a group can take within its purpose, such as finishing a wounded camp | Tactic opportunities               |
| A step or choice in carrying out an operation: camp choice, rendezvous, recovery   | The Intention's Plan               |
| A new kind of operation, such as an escort or a drop                               | A new outcome and Intention module |
| Something any competent player wants in some situation                             | A standing desire                  |
| Something this game plan wants, or an adaptation to the enemy                      | The strategy's playbook            |
| A new fact or inference about the game, such as proxy detection                    | A belief model or inference rule   |
| How the game works: damage, timings, requirements                                  | Knowledge                          |
| How to get somewhere: route danger, unit size                                      | Map knowledge and navigation       |

## 8. Changes to the current architecture

| Concept                                                     | Verdict        | Notes                                                                                                                            |
| ----------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Beliefs: Common and Scoped, models, beliefs runtime         | Keep           | Add Perception, the enemy model, and sections in the Common Beliefs                                                              |
| Assessments                                                 | Keep, narrower | Private judgments only; mechanics move to Knowledge, agreed interpretations to inferred Beliefs                                  |
| Desires, supports, staleness                                | Keep           | Importance aggregated as the maximum of supports                                                                                 |
| Permanent Desires                                           | Generalize     | Standing desires: rules over Beliefs                                                                                             |
| Option Generation                                           | Keep, extend   | Evaluates standing desires                                                                                                       |
| Deliberation                                                | Keep, extend   | Registry from outcome kind to Intention, exclusive groups, completion, the agenda                                                |
| Intention                                                   | Keep, extend   | `needs()`; `assessCommitment` returns a verdict and an interruption cost                                                         |
| Plan                                                        | Keep           | Methods as small state machines; reusable production Plans                                                                       |
| Controller                                                  | Keep           | Tactics are Controllers steering a group                                                                                         |
| Component tree, assemble functions, child factories         | Keep           |                                                                                                                                  |
| Capabilities                                                | Keep           | Force replaces actor control                                                                                                     |
| Actor Control: arbiter, policy, leases, preemptive requests | Replace        | Allocation, which keeps the lease property through needs declared every round, and Unit Behavior reflexes in place of preemption |
| Unit Assignment, strategic ownership                        | Merge          | Allocation's result                                                                                                              |
| Execution role                                              | Replace        | The Directive's task and role                                                                                                    |
| Command authority, Command Arbitration                      | Replace        | Each Unit Behavior is the single decision point for its unit                                                                     |
| Intention Scheduling                                        | Merge          | The agenda and Allocation                                                                                                        |
| Actions, execute boundary                                   | Realize        | Unit Behaviors through the order executor                                                                                        |
| Central Timing Scheduler                                    | Needed now     | Replaces `UpdateInterval`                                                                                                        |
| Strategic navigation                                        | Keep           | On map knowledge prepared when the map is built                                                                                  |
| AdaptStrategy, strategy commitment                          | Keep           | Strategy Intentions become playbooks                                                                                             |

`@lib/bdi` would gain a generic Allocation (agenda-ordered needs over assets, with matching, preference, and strength supplied by the domain, as the actor control policy is today), an agenda in the Deliberation contract, `needs` and the richer `assessCommitment` in the Intention contract, and standing desires in Option Generation. Actor Control would leave it. Directives and Unit Behaviors are Warcraft-specific and belong to `src/`.

Two module rules would change. Tactics and Unit Behaviors are building blocks, not commitments, so Intention modules may import them directly; injecting every Tactic through Deliberation would make wiring grow with every operation. Mechanics in Knowledge are shared, pure, and importable everywhere.

The current components fit the new structure:

- **MaintainWorkerSafety** becomes the reflex of worker Unit Behaviors; the Intention disappears.
- **OperateTowers** becomes the Guard Tower's Unit Behavior, whose task is today's target selection.
- **TowerRush** becomes a Human playbook expressing an operation that establishes the tower position (today's Plan, with the forward Peasants as needs), RunEconomy (today's economy Controller, generalized), and the tower repair as part of that operation.
- **AdaptStrategy** stays.

A possible layout:

```text
src/
├─ perception/      the observe boundary
├─ beliefs/         belief models: own, enemy memory and inference, neutral
├─ knowledge/       game data, combat model, map knowledge, navigation
├─ desires/         Option Generation, standing desires, outcome identity
├─ deliberation/    adoption, commitment, agenda; outcome → Intention registry
├─ allocation/      needs → forces and budgets
├─ components/
│  ├─ intentions/   operations and strategy playbooks
│  ├─ plans/        reusable Plans: construct, train, research, purchase, hire
│  └─ tactics/      reusable group Controllers
├─ units/           Unit Behaviors per unit type; shared reflexes, skills, opportunities
└─ execution/       the order executor, the only place issuing Warcraft orders
```

## 9. Roadmap

Each step leaves a working bot and updates the architecture documents.

1. **Perception and the enemy model.** Move Warcraft reads into Perception; add enemy memory (units, structures, heroes), neutral camps, and time of day. No behavior changes; everything else builds on it.
2. **Unit Behaviors and the order executor.** Every unit gets a Unit Behavior; Plans and Controllers set Directives instead of ordering. Worker safety becomes the worker reflex, tower targeting the Guard Tower's task. Actor Control still decides who may direct a unit.
3. **Agenda and Allocation.** Intentions declare needs; Allocation assigns units in agenda order behind the Force capability; Actor Control is removed. The tower rush declares its forward and home workers as needs.
4. **Standing desires and registry-based Deliberation.** DefendBase is the first standing desire, which the tower rush needs as well; completion verdicts.
5. **Knowledge and the first Tactics.** Game data for the units in use, the combat model, Skirmish and Travel, and navigation on map data from the build-map tooling.
6. **Macro.** Money and food reservations in Allocation; RunEconomy, MaintainSupply, ProduceArmy, and ReachTech with reusable Construct, Train, and Research Plans; the tower rush economy becomes RunEconomy.
7. **The Night Elf game plan.** The Fast Bears playbook phase by phase: opening and creeping with the Ancient of War, scouting, harassment and the Staff, the second hero, reuniting, the Bear timing. Each phase brings its Intentions, Tactics, and Unit Behaviors, with these scenarios as acceptance cases.

## 10. Risks and open questions

1. **Calibrating importance.** The agenda is only as good as the importances feeding it. Bands with meaning, a common value currency, importances concentrated in few places (standing desires and playbooks), and the agenda visible in debug mode keep the tuning manageable; it remains the main ongoing work.
2. **Accuracy of the combat model.** Fight or flight at every level depends on it. Start with a simple strength estimate (damage per second and life, with attack and armor types), calibrate it with in-game probes, and refine it only where decisions go wrong.
3. **Map data.** The proposal assumes the map tooling provides regions, chokes, pathing by unit size, camps, and shops; its format needs a contract.
4. **CPU budget in Lua.** Unit Behaviors run every tick for up to about a hundred units; Beliefs need spatial indexing, and slower work needs staggering. To be measured.
5. **Order semantics.** Orders cannot be queued, re-issued attacks restart, and ability and item orders need in-game verification skill by skill.
6. **Allocation oscillation** between nearly equal priorities, mitigated by the commitment bonus, displacement margins, interruption cost, and the preference for units already held.
7. **Granularity drift** toward many tiny Intentions or a few huge ones; the granularity rule and the table of homes in section 7 are the defense.
8. **Fairness.** Only Perception may feed the enemy model, and inference must not use hidden state such as the enemy's gold.

## 11. Sources worth consulting

The proposal relies on general RTS and Warcraft knowledge. For the next iteration these would add the most:

- **AMAI (Advanced Melee AI)** source, for Warcraft-specific heuristics: creep camp strength, hero retreat, Town Portal use, harassment.
- **PurpleWave and Steamhammer** (StarCraft bots), the closest prior art for priority-ordered unit and currency allocation, per-unit behavior, and squad tactics.
- **Liquipedia and W3Champions guides and recent replays** of Night Elf versus Human, for the Fast Bears playbook's timings, hero builds, and adaptations.
- **Combat models from RTS research** (Uriarte and Ontañón on combat models and kiting, Churchill's SparCraft), for the combat model.
- **Warcraft III game data tables**, as the source of Knowledge rather than hand-written numbers.
