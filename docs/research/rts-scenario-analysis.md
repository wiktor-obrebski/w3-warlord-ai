# Research: Gameplay Scenario Analysis

Companion to [`rts-behavior-architecture.md`](rts-behavior-architecture.md). It analyzes a set of Night Elf versus Human scenarios and checks every deviation against the proposed architecture. The scenarios are examples of decisions a player makes, not a split of the code:

- the default game plan (Demon Hunter and Archers into fast Bears);
- the Demon Hunter's harassment, and switching it to the Human expansion;
- buying the second hero;
- independent creeping with the second hero, then joint creeping;
- the Bear timing attack.

Each scenario comes with many deviations, numbered as in the original brief (1.1–6.34). [Section 4](#4-the-original-scenarios) reproduces the brief's scenarios for reference. Terms of the architecture are set in _**bold italics**_.

## 1. Deviations have few shapes

Every deviation has a trigger and needs a response. Every deviation appears in the first table at least once; several have more than one trigger.

| Trigger                         | Meaning                                                                | Deviations                                                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Threat                          | Enemy action endangers own assets                                      | 1.1–1.3, 1.8, 1.13, 1.19, 2.12–2.14, 2.17, 2B.6, 2B.7, 2B.12, 3.4, 3.13, 4.3, 4.8–4.10, 4.13–4.15, 5.2, 5.10, 5.13, 5.14, 6.7, 6.10, 6.11, 6.19, 6.20, 6.29, 6.33 |
| Opportunity                     | A temporary chance of gain                                             | 1.4, 1.20, 2.15, 2.16, 2.21, 2B.1, 2B.2, 2B.8, 2B.10, 2B.13, 2B.14, 3.16, 4.17, 5.15, 5.18, 6.23, 6.31, 6.32                                                      |
| Missing precondition            | A unit, resource, or requirement the _**method**_ assumed is not there | 1.10, 1.11, 1.16–1.18, 2.6–2.10, 3.1–3.10, 3.14, 4.1, 4.2, 4.4, 4.11, 5.3, 5.4, 5.8, 5.9, 5.16, 5.17, 6.5, 6.6, 6.25                                              |
| Target invalidated              | The objective's target vanished, moved, or lost its value              | 1.12, 2.2, 2.5, 2.11, 2.20, 2B.3, 2B.4, 2B.9, 4.5, 5.11, 5.12, 6.1–6.3, 6.27, 6.28                                                                                |
| Surprise or missing information | The enemy differs from what was assumed, or is not known               | 1.1, 1.4–1.8, 1.14, 1.15, 2.1, 2.3, 2.4, 2.18, 2.19, 3.11, 3.12, 3.15, 4.12, 6.4, 6.8, 6.12–6.18, 6.22, 6.24, 6.34                                                |
| Execution going badly           | The _**method**_ under-performs                                        | 1.9, 1.11, 2B.5, 4.6, 4.7, 4.11, 6.9, 6.21, 6.26, 6.30                                                                                                            |
| Competing commitments           | Valuable activities need the same assets                               | 2.14, 2B.11, 2B.12, 3.7, 3.8, 3.14, 4.1, 4.15, 4.16, 5.1, 6.19, 6.20                                                                                              |
| Milestone early or late         | A goal is reached sooner or later than the plan assumed                | 2.8, 3.1, 3.2, 4.18, 5.5–5.7                                                                                                                                      |

| Response                                  | Time scale          | Examples                                                                                                                   |
| ----------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Unit _**reflex**_ or _**skill**_          | under a second      | Wisps flee, the Demon Hunter escapes with the Staff (2.12), dodge Blizzard (6.16), last hit (2.16)                         |
| Group _**tactic**_ change                 | seconds             | leave a camp when the Humans arrive (4.8), focus Priests (6.13), kill repairing Peasants (2B.5, 6.9)                       |
| _**Method**_ change                       | seconds to a minute | next creep camp (1.12, 4.5), another harassment target, recover then resume (2.7, 5.16), wait for a safe Tavern (3.4)      |
| Reassignment                              | seconds             | the Demon Hunter leaves harassment to defend (2.14), the Ancient of War leaves production to creep (4.1)                   |
| New or dropped commitment                 | seconds             | raid a fresh expansion (1.4, 2B.1), revive a hero (1.11), attack early (1.20, 5.18)                                        |
| Strategy _**adaptation**_                 | tens of seconds     | answer a tower rush (1.1), choose the second hero (3.11), add anti-air (6.17)                                              |
| _**Belief**_ or _**assessment**_ revision | continuous          | camp seen cleared (1.12), enemy start eliminated (1.15), the Archmage teleported home (2.11), a threat rated serious (1.2) |

The triggers are open-ended, but the responses are not. Most scenarios ask the same few questions again with new _**Beliefs**_:

- Is this still worth it?
- Which target is best now?
- Fight or flee?
- Who should go?
- Do I have what I need?

An architecture that asks each question continuously, at the right level and pace, should handle unlisted scenarios mostly by adding knowledge and rules, not mechanisms.

## 2. Requirements from the scenarios

- **R1: Commitment with replaceable _methods_.** A purpose (harass the enemy hero, level the second hero, cripple the enemy economy) survives changes of target, route, _**method**_, and even units (2.1–2.21, 2B, 4.5, 6.1–6.3).
- **R2: Interruption without loss.** A commitment interrupted for something more urgent keeps its progress and resumes cheaply. Activities that are expensive to interrupt are protected (2.7, 2.14, 4.15, 5.1, 5.2).
- **R3: One priority order for contested assets.** Several activities want the same heroes, units, production buildings, gold, lumber, food, and shop stock at once. One explicit order decides (2.14, 3.7–3.9, 3.14, 4.1, 6.19, 6.20).
- **R4: Situations create _Desires_.** Threats and opportunities appear in what any unit sees, at any time. They must become candidate commitments without a dedicated watcher for each (1.1, 1.4, 1.8, 1.20, 2B.1, 5.15, 5.18, 6.32).
- **R5: Bounded opportunism.** Units and groups exploit what they meet (a dying creep, an exposed Peasant, a wounded camp), but only as far as their purpose allows. A scout may chase workers; the Wisp traveling to the Tavern may not (2.15, 2.16, 2.21, 4.17).
- **R6: _Reflexes_ faster than _deliberation_.** Survival and fight micro react within a tick or two, whoever owns the unit (2.12, 4.10, 6.15, 6.16).
- **R7: Group combat as a skill.** Each group decides, with a shared view of the fight:
  - whether to fight or flee;
  - focus fire and positioning;
  - regrouping;
  - which cheap units may be sacrificed.

  (1.9, 1.13, 4.6–4.14, 6.8–6.18, 6.30.)

- **R8: Unit- and hero-specific play.**
  - Each unit type and hero has its own abilities and typical use.
  - The same hero plays differently in different _**roles**_, such as the Demon Hunter as a harasser or in the front line.
  - Units sometimes take unusual _**roles**_: the Ancient of War as a tank, or Wisps detonating on summons.
- **R9: Knowledge under uncertainty.** Decisions rely on remembered and inferred information with age and confidence: the enemy start, hero, tech, army, expansions, and hero whereabouts (1.5–1.7, 1.14, 1.15, 2.1, 2.17, 3.11, 3.15).
- **R10: Space and time.** Many choices depend on routes, travel time, danger along routes, pathing limited by unit size, rendezvous points, and timing windows (2B.11, 3.1, 4.4, 5.8, 6.21, 6.29).
- **R11: Consistent mechanics.** These are computed one way everywhere:
  - strength estimates and fight predictions;
  - build and research times;
  - militia duration and tech requirements;
  - experience rules.

  Otherwise a defense sized by one estimate meets an attack timed by another.

- **R12: Strategy as an adaptable game plan.** The game plan has phases, milestones, hero and army choices, and _**adaptations**_ to scouted information. It is not a script (all of scenario 1, 3.11, 6.17, 6.34).
- **R13: Explainability.** For every decision it is possible to tell which _**Beliefs**_, _**Assessments**_, _**Desire**_, priority, and rule produced it.

## 3. Scenario coverage

The tables below map every deviation to the part of the [proposed architecture](rts-behavior-architecture.md) that handles it: where the decision is made, and from which information. An entry claims that the architecture has a clear place for the response, not that the bot will play it well. That depends on knowledge, estimates, and tuning that do not exist yet; [Where the coverage is thin](#where-the-coverage-is-thin) lists the entries that rest on the weakest assumptions.

**How defenses are sized.** Many entries below say `DefendBase`. The _**threat assessment**_ rates each threat lethal, serious, or small, from the enemy's strength against what defends the target. The _**base-safety concern**_ ranks it _**Survival**_, _**Emergency**_, or _**Game plan**_ accordingly, so that a small threat competes by _**weight**_. DefendBase's _**need**_ is the strength the _**combat estimate**_ says the threat requires, arriving in time. _**Allocation**_ fills it with the nearest units first and stops once it is met, so a defense reaches a distant hero only when the units at home are not enough.

### Scenario 1: default opening

| #    | Handled by                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1  | _**Plan recognition**_ reads what _**Perception**_ sees, Peasants building towers near the base, as a tower rush. The _**base-safety concern**_ proposes `DefendBase`, ranked _**Survival**_ when the rush could kill the base, so it outranks creeping. A rush of that size needs everything: _**Allocation**_ takes the Demon Hunter and the Archers from Creep, and the Ancient of War from ProduceArmy. The Siege _**Tactic**_ kills the builders and unfinished towers first. The _**playbook**_'s tower-rush _**adaptation**_ changes the build. |
| 1.2  | `DefendBase` is sized by the threat, Militia included, and the Hold _**Tactic**_ fights by the Moon Wells. Wisps flee by _**reflex**_. The Militia duration from _**Knowledge**_ lets the _**Tactic**_ delay the fight until they turn back into Peasants.                                                                                                                                                                                                                                                                                             |
| 1.3  | Wisps flee by _**reflex**_. `DefendBase`'s _**weight**_ follows the Wisps at risk, and its _**need**_ is filled from the units at home first. It reaches the distant Demon Hunter only if they are not enough and he can arrive in time, which takes the Staff. RunEconomy moves Wisps to safer trees and trains replacements. The lost lumber delays the _**playbook**_'s phases, as in 1.16.                                                                                                                                                         |
| 1.4  | The sighting becomes a remembered enemy base, and _**plan recognition**_ reads it as a fast expansion. The _**playbook**_'s _**adaptation**_ proposes `RaidBase` on it. The _**agenda**_ and the _**switching rule**_ decide whether the Demon Hunter leaves his current activity.                                                                                                                                                                                                                                                                     |
| 1.5  | A Keep seen early, with no expansion, makes _**plan recognition**_ favor a Tier 2 rush. The _**playbook**_ adds defensive production and shifts the second-hero preference.                                                                                                                                                                                                                                                                                                                                                                            |
| 1.6  | Barracks and Footmen seen make _**plan recognition**_ favor mass Footmen. The _**playbook**_ lowers the harassment's _**weight**_ so the Demon Hunter stays near home, and adds defensive production.                                                                                                                                                                                                                                                                                                                                                  |
| 1.7  | The enemy hero's type enters the _**Beliefs**_. The _**playbook**_ changes the harassment's _**weight**_, and the _**combat estimate**_ changes the risk of creeping and of meeting him.                                                                                                                                                                                                                                                                                                                                                               |
| 1.8  | Enemy production buildings or Scout Towers seen far from the enemy base make _**plan recognition**_ favor a proxy. The _**threat assessment**_ counts enemy structures near own bases, so the _**base-safety concern**_ proposes `DefendBase`, and the _**playbook**_ adapts.                                                                                                                                                                                                                                                                          |
| 1.9  | The CreepCamp _**Tactic**_ re-evaluates the fight, and retreats or pulls again. The Demon Hunter retreats by _**reflex**_, and the Ancient eats a tree. Afterwards Creep's _**method**_ prefers easier camps.                                                                                                                                                                                                                                                                                                                                          |
| 1.10 | ProduceArmy has no producer, so its _**method**_ builds a new Ancient of War first. Creep's _**method**_ with the Ancient as tank no longer applies, and the runtime picks another. The _**playbook**_ may reorder the opening.                                                                                                                                                                                                                                                                                                                        |
| 1.11 | The _**hero concern**_ proposes `ReviveHero`, and _**Allocation**_ reserves gold and the Altar for it. _**Intentions**_ that need the hero pause, since their context fails. The _**playbook**_ may turn defensive until he is back.                                                                                                                                                                                                                                                                                                                   |
| 1.12 | The camp seen cleared updates the neutral _**Beliefs**_ and the estimate of the enemy hero's whereabouts. Creep's _**method**_ picks the next camp.                                                                                                                                                                                                                                                                                                                                                                                                    |
| 1.13 | The CreepCamp _**Tactic**_ evaluates the creeps and the Human army together, and retreats if the fight is lost. Last hits and the item drop are _**opportunities**_.                                                                                                                                                                                                                                                                                                                                                                                   |
| 1.14 | Scout's _**need**_ for a unit is unmet again, so _**Allocation**_ takes another Wisp from RunEconomy; whether scouting is still worth a Wisp is the _**scouting concern**_'s _**weight**_. Meanwhile decisions use what is known, with its confidence, and the _**playbook**_'s defaults.                                                                                                                                                                                                                                                              |
| 1.15 | Start locations seen empty are eliminated, and Scout's _**method**_ visits the next most likely one. Elimination can confirm the last candidate without seeing it.                                                                                                                                                                                                                                                                                                                                                                                     |
| 1.16 | RunEconomy rebalances the Wisps and trains more. Money is still reserved in _**agenda**_ order, so the most important spending waits least. The _**playbook**_'s phases, entered by conditions, slip with the economy.                                                                                                                                                                                                                                                                                                                                 |
| 1.17 | MaintainSupply predicts food from production and reservations, builds ahead, and rebuilds lost Moon Wells. Moon Well mana is a _**Belief**_ the Recover _**Tactic**_ weighs against other ways to heal.                                                                                                                                                                                                                                                                                                                                                |
| 1.18 | ReachTech's _**method**_ follows the requirements from _**Knowledge**_ and builds again, waiting while the site is unsafe.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1.19 | The _**threat assessment**_ counts structures under construction, so `DefendBase`'s _**weight**_ includes them. A building's _**reflex**_ cancels a construction about to be destroyed.                                                                                                                                                                                                                                                                                                                                                                |
| 1.20 | Deaths seen lower the enemy army estimate, and the _**relative strength assessment**_ turns in our favor. The _**playbook**_'s _**adaptation**_ proposes `Attack`, its _**weight**_ decaying as the enemy rebuilds.                                                                                                                                                                                                                                                                                                                                    |

### Scenario 2: Demon Hunter harassment

| #    | Handled by                                                                                                                                                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | The _**enemy model**_ estimates the Archmage's whereabouts from his last sighting, camps found cleared, and likely creeping routes. The harassment's _**method**_ searches the likely places, creeping on the way.                                                                                   |
| 2.2  | When the Archmage stays where harassing is too dangerous, the harassment becomes impossible and fails with that reason. _**Allocation**_ gives the Demon Hunter to `Creep{Demon Hunter}`, which the _**playbook**_ proposes at a lower _**weight**_ in this phase.                                   |
| 2.3  | The HitAndRun _**Tactic**_ weighs the escort with the _**combat estimate**_, keeps an escape route, and burns mana from range.                                                                                                                                                                       |
| 2.4  | The Archmage's level is seen. The _**playbook**_ lowers the harassment's _**weight**_ as it rises, and the _**combat estimate**_ counts the stronger Water Elementals.                                                                                                                               |
| 2.5  | The Archmage's mana is seen. Mana Burn scores low against an empty pool, and the _**Tactic**_ weighs killing the Archmage or a Water Elemental instead.                                                                                                                                              |
| 2.6  | Without mana for Mana Burn, the _**Tactic**_ and the _**Unit Behavior**_'s _**opportunities**_ turn to killing units and stealing creeps.                                                                                                                                                            |
| 2.7  | The retreat _**reflex**_ fires, then the _**method**_'s recover step heals at a Moon Well, a fountain, or with potions. The harassment then resumes.                                                                                                                                                 |
| 2.8  | The _**playbook**_'s Harass phase starts only when the Demon Hunter reaches level 2, so there is no harassment _**Desire**_ yet. The _**playbook**_ may skip the harassment when the delay is long.                                                                                                  |
| 2.9  | AcquireItem pauses until restock, or settles for another item. What is known of the stock is in the _**Beliefs**_, and a failed purchase is an _**observation**_ too. Meanwhile the harassment gets the Demon Hunter, and without an escape item its _**method**_ allows him less risk.              |
| 2.10 | AcquireItem's _**method**_ waits while the shop is dangerous, or uses another shop.                                                                                                                                                                                                                  |
| 2.11 | Seen using a Town Portal, the Archmage is believed home. The _**Tactic**_ loses its target, and the _**method**_ searches again.                                                                                                                                                                     |
| 2.12 | The Demon Hunter's escape _**reflex**_ uses the Staff, a potion, or the weakest gap.                                                                                                                                                                                                                 |
| 2.13 | The HitAndRun _**Tactic**_'s fight evaluation crosses its disengage threshold.                                                                                                                                                                                                                       |
| 2.14 | A serious attack ranks `DefendBase` _**Emergency**_, above the harassment. Its _**need**_ still takes the units at home first, and reaches the Demon Hunter only if they are not enough; the Staff lets him arrive in time. The _**playbook**_ may answer with `RaidBase` on the enemy main instead. |
| 2.15 | An opportunity for the _**Tactic**_ or the _**Unit Behavior**_, within the leash.                                                                                                                                                                                                                    |
| 2.16 | Last-hit timing is in the _**Unit Behavior**_, and the _**Tactic**_ keeps the Demon Hunter by the dying creep.                                                                                                                                                                                       |
| 2.17 | The bot does not recognize a bait as intent; it limits exposure. The _**danger assessment**_ includes where the enemy army probably is in the fog, and the chase leash and the risk _**latitude**_ stop pursuit into likely traps.                                                                   |
| 2.18 | The new hero raises the risk in the _**combat estimate**_, and the _**playbook**_ lowers the harassment's _**weight**_.                                                                                                                                                                              |
| 2.19 | Known towers raise the _**danger assessment**_ along the routes they cover. Navigation and the _**Tactic**_ keep the mana-dependent hero out of their range.                                                                                                                                         |
| 2.20 | The _**method**_ cycles through search, engage, and recover. The whereabouts estimate updates when the Archmage reappears.                                                                                                                                                                           |
| 2.21 | The wounded camp is in the neutral _**Beliefs**_. Finishing it is an opportunity for the _**method**_ or the _**Tactic**_.                                                                                                                                                                           |

### Scenario 2B: harassing the Human expansion

| #     | Handled by                                                                                                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2B.1  | `RaidBase` weighs heavily for a Hall under construction, so the _**switching rule**_ lets _**Allocation**_ move the Demon Hunter from the harassment. The Siege _**Tactic**_ kills the builder first. |
| 2B.2  | The Siege _**Tactic**_'s kill order puts Peasants above the Hall.                                                                                                                                     |
| 2B.3  | The raid's _**weight**_ is low or 0: no raid is adopted, or the running one is dropped with its _**Desire**_.                                                                                         |
| 2B.4  | The _**Tactic**_ kills the tower builders, or leaves before the towers finish, using their build time from _**Knowledge**_.                                                                           |
| 2B.5  | Repairing Peasants rise in the kill order.                                                                                                                                                            |
| 2B.6  | The _**Tactic**_ disengages, and the _**method**_ comes back after the Militia turn back into Peasants; their duration is _**Knowledge**_.                                                            |
| 2B.7  | When the Archmage is seen approaching or using a Town Portal, the _**Tactic**_ leaves before he arrives, and the raid's _**weight**_ drops.                                                           |
| 2B.8  | The raid continues while its fight evaluation allows.                                                                                                                                                 |
| 2B.9  | The raid's target is gone, so it fails with that reason. The harassment, re-checked, gets the Demon Hunter back.                                                                                      |
| 2B.10 | A second `RaidBase` _**Desire**_ appears, and the enemy economy estimate grows. The _**agenda**_ and the _**switching rule**_ decide which raid gets the Demon Hunter.                                |
| 2B.11 | Travel time lowers the raid's _**weight**_, and a raid that cannot arrive within its _**window**_ gets _**weight**_ 0. Navigation picks the route.                                                    |
| 2B.12 | A serious attack ranks `DefendBase` above the raid, but it takes the Demon Hunter only if the units at home are not enough.                                                                           |
| 2B.13 | The _**playbook**_ proposes `RaidBase` on the enemy main while its army is away.                                                                                                                      |
| 2B.14 | The fight evaluation counts the creeps against the enemy: strike while they fight the camp.                                                                                                           |

### Scenario 3: the second hero

| #          | Handled by                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1, 3.2   | HireHero's _**method**_ sends its Wisp by the predicted Tier 2 completion minus the travel time (3.1). If the research slips, the prediction moves, and a Wisp already there waits safely (3.2). |
| 3.3        | HireHero's _**need**_ is unmet again, so _**Allocation**_ provides another Wisp.                                                                                                                 |
| 3.4        | HireHero's _**method**_ waits at a safe distance, weighing the hero's value against the risk.                                                                                                    |
| 3.5, 3.6   | What is known of the Tavern's stock is in the _**Beliefs**_: heroes the enemy was seen with, and failed hires. HireHero takes the other candidate, or waits for restock.                         |
| 3.7        | Gold is reserved in _**agenda**_ order, so the hire and defensive production get money as their _**ranks**_ and _**weights**_ say.                                                               |
| 3.8        | Lumber is reserved in _**agenda**_ order too, so the _**playbook**_'s _**weights**_ decide whether tech or the hire comes first.                                                                 |
| 3.9        | MaintainSupply counts the food reserved for the hero and builds ahead.                                                                                                                           |
| 3.10       | HireHero's _**method**_ resolves the requirement from _**Knowledge**_ and builds a new Altar first.                                                                                              |
| 3.11, 3.12 | The _**playbook**_'s rule chooses the hero at hire time, against the latest estimate of the enemy composition.                                                                                   |
| 3.13       | The new hero starts in Reserve, and `DefendBase`, which outranks Creep, claims him if the units at home are not enough.                                                                          |
| 3.14       | `ReviveHero` and HireHero compete for gold in _**agenda**_ order.                                                                                                                                |
| 3.15       | The _**playbook**_ adapts the army and items; the hire is not undone.                                                                                                                            |
| 3.16       | `RaidBase` claims the new hero if it stands above Creep on the _**agenda**_.                                                                                                                     |

### Scenario 4: the second hero creeps with the Archers

| #        | Handled by                                                                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1      | Creep and ProduceArmy have the same _**rank**_, so the _**switching rule**_ protects the Archer in training, ProduceArmy's _**interruption cost**_. Creep's _**method**_ gathers the others and leaves when the Ancient is released. |
| 4.2      | Creep's _**method**_ leaves the Ancient behind, or waits while it heals by eating trees or at the Moon Wells.                                                                                                                        |
| 4.3      | The Travel _**Tactic**_ keeps the group together, and the fight evaluation runs on contact.                                                                                                                                          |
| 4.4      | Navigation works by unit size. Camp choice excludes camps the Ancient cannot reach, or leaves it behind.                                                                                                                             |
| 4.5      | Creep's _**method**_ picks the next camp.                                                                                                                                                                                            |
| 4.6, 4.7 | The CreepCamp _**Tactic**_'s fight evaluation and pulling decide, using the creeps' abilities from _**Knowledge**_; it retreats if needed.                                                                                           |
| 4.8, 4.9 | The fight evaluation treats the creeps as a third party: contest, finish the camp quickly, or leave. Last hits and the item drop are _**opportunities**_.                                                                            |
| 4.10     | The hero's _**reflex**_ pulls back, and the _**Tactic**_ turns on the attackers or covers the hero.                                                                                                                                  |
| 4.11     | ProduceArmy's desired total replaces the losses. Meanwhile Creep's _**method**_ picks easier camps, and the _**playbook**_ may lower creeping.                                                                                       |
| 4.12     | Target pickers know from _**Knowledge**_ how Defend reduces piercing damage. The _**Tactic**_ focuses heroes and Footmen not defending, and the heroes' attacks and spells, which Defend does not reduce, matter more.               |
| 4.13     | The kill order weighs summons by their remaining duration, and the Archers kite them.                                                                                                                                                |
| 4.14     | Fight evaluation and positioning decide, and the Archers kite or retreat.                                                                                                                                                            |
| 4.15     | A serious attack ranks `DefendBase` above Creep, but it takes the army only if the units at home are not enough.                                                                                                                     |
| 4.16     | The harassment requests `ProtectUnit{Demon Hunter}`, which may take the army from Creep on the _**agenda**_.                                                                                                                         |
| 4.17     | Camp choice values mercenary camps and item drops, and the _**playbook**_ may want mercenaries. An enemy caught creeping is a chance the _**playbook**_ turns into a _**Desire**_, as in 2B.14.                                      |
| 4.18     | Creep is achieved, and the _**playbook**_ enters its next phase.                                                                                                                                                                     |

### Scenario 5: joint creeping

| #        | Handled by                                                                                                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1      | The _**playbook**_ keeps proposing the harassment at a lower _**weight**_. Within the same _**rank**_, the _**switching rule**_ protects its engagement under way, so the Demon Hunter joins when it ends. |
| 5.2      | His _**reflexes**_ work whoever owns him. If Creep holds him, its _**method**_ moves the army to meet him; if the harassment still does, it requests `ProtectUnit{Demon Hunter}`.                          |
| 5.3, 5.4 | The _**hero concern**_ proposes `ReviveHero`. Creep continues with the hero still alive, and takes the revived one back.                                                                                   |
| 5.5–5.7  | Phase conditions follow the heroes' levels (5.5, 5.6). Creep's goal says which heroes to level, and its _**Tactic**_ keeps the others out of experience range when that matters (5.6, 5.7).                |
| 5.8      | Creep's _**method**_ picks a rendezvous camp between the groups.                                                                                                                                           |
| 5.9      | Travel time is computed on foot, so Creep's _**method**_ picks a rendezvous nearer to him.                                                                                                                 |
| 5.10     | Once Creep holds both groups, it steers each with its own _**Tactic**_, and its _**method**_ decides whether the other group helps or the intercepted one withdraws.                                       |
| 5.11     | With no camps left, Creep is achieved or impossible, and the _**playbook**_ moves on.                                                                                                                      |
| 5.12     | Camp choice weighs the risk from the _**combat estimate**_ and the _**danger assessment**_. When no camp is worth it, Creep fails with that reason.                                                        |
| 5.13     | The fight evaluation decides the contest.                                                                                                                                                                  |
| 5.14     | `DefendBase` outranks joint creeping, and an attack of this size needs the army back.                                                                                                                      |
| 5.15     | The _**playbook**_ proposes `RaidBase`, which competes with creeping for the heroes.                                                                                                                       |
| 5.16     | Creep's _**method**_ recovers before the next camp: Moon Wells, fountains, or potions.                                                                                                                     |
| 5.17     | Moon Well mana is in the _**Beliefs**_, and how it regenerates is _**Knowledge**_. The Recover _**Tactic**_ chooses fountains, potions, or waiting.                                                        |
| 5.18     | The _**playbook**_ adapts to a weakened enemy and proposes `Attack`.                                                                                                                                       |

### Scenario 6: the Bear timing

| #          | Handled by                                                                                                                                                                                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1–6.4    | The _**playbook**_ proposes `Attack`, and its _**method**_ picks the most valuable vulnerable target among known and inferred enemy bases. With several expansions (6.4), destroying one is worth less.                                                                                                               |
| 6.5        | The _**playbook**_'s timing condition is the _**relative strength assessment**_, not the upgrade alone.                                                                                                                                                                                                               |
| 6.6        | ProduceArmy rebuilds the Ancients of Lore, and the _**playbook**_ may delay the timing.                                                                                                                                                                                                                               |
| 6.7        | `DefendBase`, with the army as it is: the _**combat estimate**_ counts no Bear Form.                                                                                                                                                                                                                                  |
| 6.8–6.10   | The Siege _**Tactic**_'s fight evaluation counts the towers. Its kill order puts repairing Peasants first, and it delays the fight while Militia are active.                                                                                                                                                          |
| 6.11       | A Town Portal seen, or the army arriving, makes the Siege _**Tactic**_ re-evaluate. The _**method**_ may withdraw and strike elsewhere.                                                                                                                                                                               |
| 6.12       | The _**Tactic**_ focuses the Sorceresses, and Dryads, if present, dispel Slow with Abolish Magic.                                                                                                                                                                                                                     |
| 6.13       | Healers rise in the kill order.                                                                                                                                                                                                                                                                                       |
| 6.14       | The _**skill**_ policy avoids casting Rejuvenation and Roar near Spell Breakers, and they rise in the kill order.                                                                                                                                                                                                     |
| 6.15       | Hero _**reflexes**_ keep distance from the Mountain King when low, and the _**Tactic**_ focuses him and spreads against Thunder Clap.                                                                                                                                                                                 |
| 6.16       | The _**reflex**_ steps out of Blizzard, and the _**Tactic**_ spreads the army.                                                                                                                                                                                                                                        |
| 6.17       | The _**playbook**_ adapts the composition for anti-air, and the Attack's _**method**_ targets structures.                                                                                                                                                                                                             |
| 6.18       | Siege units behind the front rise in the kill order.                                                                                                                                                                                                                                                                  |
| 6.19, 6.20 | A serious attack ranks `DefendBase` above the Attack, but it takes from the Attack only what the units at home cannot cover. For a base trade, the _**playbook**_ ranks the Attack equally, and the _**switching rule**_ weighs the Attack's _**interruption cost**_. `RaidBase` on the enemy main is another answer. |
| 6.21       | The Siege _**Tactic**_'s fight evaluation counts only the units that can reach targets, and it uses chokes from the map in _**Beliefs**_ to choose where to fight.                                                                                                                                                    |
| 6.22, 6.23 | The _**relative strength assessment**_ feeds the _**playbook**_'s timing rule and the Attack's conditions: a larger enemy delays the attack (6.22), a beaten one brings it forward (6.23).                                                                                                                            |
| 6.24       | _**Tactics**_ re-evaluate continuously, and the _**playbook**_ adapts the composition.                                                                                                                                                                                                                                |
| 6.25, 6.26 | The Attack's _**method**_ re-checks the army's strength before engaging, and the _**Intention**_ fails with that reason once the attack is no longer viable. `ReviveHero` handles the dead hero (6.25).                                                                                                               |
| 6.27, 6.28 | A base's value is in the _**Beliefs**_: estimated gold left and workers seen. The _**method**_ retargets when it falls.                                                                                                                                                                                               |
| 6.29       | The Attack's _**method**_ sends reinforcements through the Travel _**Tactic**_, in groups and on safe routes.                                                                                                                                                                                                         |
| 6.30       | The _**Tactic**_ retreats. The _**method**_ regroups with reinforcements, or the _**Intention**_ fails with that reason.                                                                                                                                                                                              |
| 6.31       | The fight evaluation improves, so the _**method**_ presses on, and the _**playbook**_ adapts to a weakened enemy.                                                                                                                                                                                                     |
| 6.32       | The Attack's _**method**_ retargets, or the _**playbook**_ proposes `RaidBase` on the exposed target.                                                                                                                                                                                                                 |
| 6.33       | `DefendBase`, with what arrives in time.                                                                                                                                                                                                                                                                              |
| 6.34       | The _**strategy concern**_ reads the _**relative strength assessment**_ and reconsiders the _**playbook**_.                                                                                                                                                                                                           |

### Where the coverage is thin

Every entry above names a home for the response. These entries rest on parts that are hard, unbuilt, or unverified:

- **The _combat estimate_.** Fight-or-flight decisions and the size of every defense rest on it: 1.2, 1.3, 1.9, 1.13, 2.3, 2.13, 2.14, 2B.8, 2B.14, 4.6–4.9, 4.13, 4.14, 5.12, 5.13, 6.5, 6.22–6.24, 6.30. The architecture document starts from a cheap strength estimate with named modifiers; whether that suffices is open.
- **_Plan recognition_.** Under fog it is often ambiguous, and a wrong call becomes a wrong _**adaptation**_ (1.1, 1.4–1.8, 3.11, 3.12, 6.4, 6.17). _**Adaptations**_ scale with its confidence, and scouting resolves close calls.
- **The enemy's whereabouts and intent.** Estimates of where unseen heroes and armies are may be poor (2.1, 2.17, 2.20, 5.10, 6.11). The bot reacts to what it sees and infers; it does not model the opponent's decisions, such as baiting (2.17), coming back to defend (2B.7, 2B.8), or trading bases (6.20).
- **What _Perception_ can read.** Shop and Tavern stock (2.9, 3.5, 3.6) may not be readable through natives, or not fairly. Then it is inferred from heroes seen and failed purchases.
- **Map data.** Pathing by unit size, chokes, and routes (2B.11, 4.4, 5.8, 6.21) start from the map tooling, whose output format is not yet defined, and change during the game as trees fall and structures go up.
- **Orders not yet verified in the game.** Item and ability use: the Staff (2.12, 2.14), Mana Burn (2.5), Eat Tree (1.9, 4.2), canceling a construction (1.19), Abolish Magic (6.12).
- **Fine timing.** Last hits (1.13, 2.16, 4.8) and stepping out of Blizzard (6.16) need damage and spell prediction within a 0.1 s tick.
- **Calibration.** Which commitment wins (1.4, 2.14, 2B.1, 4.1, 5.1, 6.19, 6.20) depends on _**ranks**_, _**weights**_, and _**interruption costs**_ that are not tuned yet, including where a threat stops being small.

The architecture document's [risks and open questions](rts-behavior-architecture.md#10-risks-and-open-questions) cover each of these.

## 4. The original scenarios

The scenarios and their deviations as written in the research brief (17 October 2026).

### Scenario 1 — Default opening: DH + Archers → Fast Bears

The Night Elf follows the standard fast-tech build: Demon Hunter, Archers, early creeping with Ancient of War, progression through Tier 2 to Tier 3, and eventual production of Master Druids of the Claw.

#### 1.1 — Human tower rush

Human sends Peasants, supported by Footmen or a hero, to construct towers near or inside the Night Elf base. The threat can become fatal before the planned tech progression finishes.

#### 1.2 — Early Footmen and Militia attack

Human attacks the Night Elf base with Footmen, potentially reinforced by Militia. Wisps, Moon Wells, and the Ancient of War become immediate targets.

#### 1.3 — Human attacks lumber Wisps

A group of Footmen enters the Night Elf base while DH is away and starts killing Wisps collecting lumber. The resulting resource losses can significantly delay tech and production.

#### 1.4 — Human fast expansion discovered

The scouting Wisp discovers several Militia clearing an expansion camp or Peasants constructing an early Town Hall. Human is attempting to establish a significant economic advantage before the Night Elf reaches bears.

#### 1.5 — Human rushes Tier 2 without expanding

Scouting reveals an early Human tech upgrade rather than an expansion. A faster arrival of Riflemen, a second hero, or Arcane Sanctum units becomes possible.

#### 1.6 — Human prepares mass Footmen

Multiple Barracks or unusually heavy Footman production indicate a much larger early army than expected. This creates the possibility of an aggressive attack before Night Elf tech units appear.

#### 1.7 — Human uses an unexpected first hero

Scouting identifies Mountain King, Paladin, or Blood Mage instead of the expected Archmage. The opponent's early combat capabilities and creeping behavior differ substantially from the assumed matchup.

#### 1.8 — Human begins a proxy attack

A scouting Wisp discovers Human production buildings or forward Scout Towers near the Night Elf base. The opponent is preparing pressure from outside their main base.

#### 1.9 — Ancient of War creeping goes badly

The Ancient of War or Demon Hunter takes unexpectedly high damage, or creep positioning causes the pull to fail. The planned early experience and item acquisition become much more expensive.

#### 1.10 — Ancient of War is destroyed

The Ancient of War dies during creeping or an enemy attack. Archer production stops until another production building becomes available.

#### 1.11 — Demon Hunter dies while creeping

An early creeping mistake or enemy interference kills the first hero. The opening loses its primary combat unit and faces an expensive revival delay.

#### 1.12 — Creeping camp is already cleared

The opponent has taken a nearby camp that was supposed to provide early experience and an item. The planned opening route no longer provides the expected rewards.

#### 1.13 — Creeping camp is contested

The Human army arrives while DH and Ancient of War are fighting neutral creeps. The encounter creates a risk of losing units, experience, or valuable creep drops.

#### 1.14 — Scouting Wisp is killed

The Wisp dies before gathering enough information about Human's hero, tech, or expansion. Important early decisions must now be made with incomplete information.

#### 1.15 — Enemy base is not where expected

On a map with several possible starting positions, the scouting Wisp visits an incorrect location. Information about Human's opening arrives later than planned.

#### 1.16 — Lumber income falls below expectations

Wisp losses, insufficient lumber collection, or unexpectedly expensive defensive actions delay important construction and upgrades.

#### 1.17 — Moon Well capacity becomes insufficient

Production reaches the supply limit because a Moon Well was delayed or destroyed. Alternatively, repeated healing leaves the existing Moon Wells without enough mana to sustain the army and heroes.

#### 1.18 — Hunter's Hall construction is interrupted

The Hunter's Hall is delayed, canceled, or destroyed. Access to the intended Ancient of Lore and bear-tech progression is postponed.

#### 1.19 — Ancients of Lore are attacked during construction

Human pressure reaches the Night Elf base around Tier 2 and targets the emerging Ancients of Lore. The transition to Druids of the Claw becomes threatened.

#### 1.20 — Human unexpectedly loses significant early forces

Human suffers heavy casualties while creeping, attacking, or defending an expansion. The opponent is temporarily much weaker than the original build assumes.

### Scenario 2 — Demon Hunter harassment of the Archmage

After reaching level 2, DH obtains a Staff of Teleportation and attempts to locate the Archmage while creeping. He uses Mana Burn, attacks vulnerable units, contests creep kills, and retreats to heal before resuming harassment.

#### 2.1 — Archmage cannot be located

The expected Human creeping route is empty, and scouting provides no reliable information about the Archmage's current position.

#### 2.2 — Archmage remains inside the Human base

Instead of creeping outside, the Archmage stays near the main base and its defenses. The expected opportunities for harassment are absent.

#### 2.3 — Archmage is creeping with a large escort

DH encounters the Archmage protected by numerous Footmen, Water Elementals, or Militia. Direct harassment is significantly more dangerous than expected, but still possible with caution, big surrounding risk.

#### 2.4 — Archmage reaches level 3 early

The opponent achieves level 3 before DH can seriously interfere. Level 2 Water Elementals substantially increase the strength of Human creeping and combat.

#### 2.5 — Archmage is already low on mana

DH discovers that the Archmage has almost exhausted his mana through Water Elemental summons or other abilities. Mana Burn has little immediate value.

#### 2.6 — Demon Hunter runs out of mana

DH has enough health to continue harassing but lacks mana for further Mana Burns. His ability to interfere with the Archmage becomes limited, but he can still kill some units or steal some creeps.

#### 2.7 — Demon Hunter is badly wounded

After an engagement or difficult creep camp, DH has insufficient health for another safe encounter. His harassment activity is interrupted even though the enemy remains active.

#### 2.8 — Demon Hunter fails to reach level 2 on time

The initial creeping route provides insufficient experience, or an earlier disruption delays leveling. The intended harassment start time is missed.

#### 2.9 — Staff of Teleportation is unavailable

DH reaches a Goblin Merchant before the item becomes available, or the item has already been purchased and is temporarily out of stock. The planned escape and travel options are reduced.

#### 2.10 — Goblin Merchant is controlled by enemy forces

Human units occupy the area around the merchant. Buying the Staff of Teleportation or other useful items involves immediate combat risk.

#### 2.11 — Archmage retreats using Town Portal

The Archmage escapes an unfavorable engagement by teleporting to his base. An apparently promising opportunity to kill him disappears.

#### 2.12 — Demon Hunter is surrounded

Footmen, Militia, or other Human units trap DH and prevent him from simply walking away. A previously manageable engagement becomes a potential hero-loss situation.

#### 2.13 — Archmage suddenly receives reinforcements

Additional Riflemen, Footmen, or a second hero join the Archmage during harassment. The local balance of forces changes unexpectedly.

#### 2.14 — Human begins attacking the Night Elf base

While DH is deep in enemy territory, Human forces attack Wisps, Moon Wells, or tech buildings at home. Harassment is now competing with an urgent defensive situation.

#### 2.15 — A vulnerable Human unit becomes exposed

An injured Footman, isolated Rifleman, or low-health Peasant becomes accessible during the harassment. This creates a valuable alternative to continuing the pursuit of the Archmage.

#### 2.16 — Human threatens a creep last hit

Both heroes are positioned near a heavily wounded neutral creep. A small timing difference determines which player receives its experience and potentially its item.

#### 2.17 — Human reverses the harassment

The opponent deliberately draws DH toward a creep camp or another group of Human units. The hunter becomes the target of a dangerous engagement.

#### 2.18 — Human obtains a second hero during harassment

A Mountain King, Naga, or another hero arrives while DH is still operating alone. New disabling abilities or concentrated damage make continued harassment substantially riskier.

#### 2.19 — Human uses defensive towers to protect important areas

An Arcane Tower or other defenses cover the routes around the main base or expansion. Approaching these positions, especially with a mana-dependent hero, becomes costly.

#### 2.20 — Human retreats to heal and then resumes creeping

The Archmage temporarily disappears into a protected area, restores health or mana, and later reappears elsewhere. Harassment can become a repeated pursuit rather than one continuous engagement.

#### 2.21 — Human retreats leaving almost dead creeps camp

Human retreats leaving almost dead creep camp that DH can safely creep himself.

### Scenario 2B — Switching harassment to the Human expansion

During DH harassment, a Human expansion is discovered. The harassment target changes from the Archmage's creeping activity to the expansion, its construction, workers, or defenses.

#### 2B.1 — Town Hall construction has just started

DH discovers a vulnerable expansion with an incomplete Town Hall and relatively few defenders.

#### 2B.2 — Human expansion is already operational

The Town Hall is complete and Peasants are mining gold. The expansion is already generating economic value.

#### 2B.3 — Expansion is heavily fortified

Guard Towers, Arcane Towers, defensive building placement, and military units make direct harassment difficult.

#### 2B.4 — Human starts building towers during harassment

The expansion initially has weak defenses, but several Peasants begin constructing Scout Towers. Its defensive strength is about to increase.

#### 2B.5 — Peasants rapidly repair damaged structures

Several Peasants repair the Town Hall or towers while DH attacks. Damage that initially appeared meaningful is being restored.

#### 2B.6 — Militia arrive to defend the expansion

Workers from the Human main base arrive as Militia or nearby workers are converted into Militia. The local defender count rises sharply.

#### 2B.7 — Archmage returns to protect the expansion

The Archmage abandons creeping and arrives with supporting units, potentially using a Scroll of Town Portal. The expansion changes from an economic target into a defended combat position.

#### 2B.8 — Human continues creeping despite the expansion attack

The enemy hero remains elsewhere, apparently accepting some expansion damage in exchange for experience or map control.

#### 2B.9 — Human abandons the expansion

Construction stops, surviving Peasants leave, or the incomplete Town Hall is canceled. The original harassment objective disappears.

#### 2B.10 — A second Human expansion is discovered

Scouting identifies another Town Hall or expansion attempt elsewhere. The economic situation is more complicated than a single exposed expansion.

#### 2B.11 — Expansion is located far from DH

The expansion is on the opposite side of the map from the current harassment. Traveling there requires considerable time and separates DH from other activities.

#### 2B.12 — Expansion harassment exposes the Night Elf base

Human forces move toward the Night Elf main base while DH is occupied at the expansion. The opponent threatens critical infrastructure during the harassment.

#### 2B.13 — Human main base becomes exposed

A large share of Human units leaves the main base to defend the expansion. Workers and production structures in the original base become comparatively vulnerable.

#### 2B.14 — Expansion is discovered while Human is creeping its camp

DH arrives while Human Militia and the Archmage are still fighting neutral defenders. Both the expansion attempt and the creep encounter are vulnerable to interference.

### Scenario 3 — Purchasing the second hero

As Tier 2 approaches completion, a Wisp moves toward the Tavern. The Night Elf purchases Naga Sea Witch or Pandaren Brewmaster, depending on the observed Human composition and broader situation.

#### 3.1 — Tier 2 finishes earlier than expected

The Tree of Ages upgrade completes while the designated Wisp is still far from the Tavern. The intended second hero cannot be purchased immediately.

#### 3.2 — Tier 2 is significantly delayed

Resource problems, worker losses, or base pressure postpone the Tree of Ages upgrade. The Wisp may reach the Tavern long before a second hero can be recruited.

#### 3.3 — Traveling Wisp is killed

A Footman, Rifleman, hero, or neutral creep kills the Wisp on its way to the Tavern.

#### 3.4 — Tavern is occupied by Human forces

Enemy heroes and units are positioned around the Tavern. The arriving Wisp is vulnerable, and the newly purchased hero may immediately face danger.

#### 3.5 — Naga is temporarily unavailable

Human has already hired the Naga Sea Witch from the Tavern's limited stock. The preferred second hero cannot be obtained at the intended moment.

#### 3.6 — Pandaren Brewmaster is temporarily unavailable

The alternative hero is also unavailable because another player recently hired him. The intended purchase must change or be postponed.

#### 3.7 — Not enough gold to purchase the hero

Unexpected spending, defensive production, or worker losses leave insufficient gold for the second hero when Tier 2 completes.

#### 3.8 — Insufficient lumber for the planned progression

The hero may be affordable, but low lumber reserves threaten important Tier 2 buildings or the subsequent Tier 3 upgrade. The original sequence of purchases becomes difficult to maintain.

#### 3.9 — Supply limit prevents hero recruitment

Moon Wells provide insufficient food capacity for the intended second hero. Production or construction timing has diverged from the planned build.

#### 3.10 — Altar of Elders is destroyed

Human destroys the Altar before the neutral hero purchase. Without an Altar, the Night Elf cannot hire a Tavern hero.

#### 3.11 — Human is massing vulnerable infantry or casters

Scouting reveals a large number of Footmen, Riflemen, Priests, or Sorceresses. The enemy composition differs from one dominated by a small number of durable targets.

#### 3.12 — Human relies on a few valuable heroes or units

Human's strength is concentrated in a small number of important targets, such as an Archmage supported by a Mountain King and a modest army. Hero focus and single-target combat become particularly relevant.

#### 3.13 — Human prepares an immediate Tier 2 attack

Human units are already approaching the Night Elf base when the second hero becomes available. The new hero is entering an active defensive situation rather than beginning an independent creeping route.

#### 3.14 — Demon Hunter dies shortly before Tier 2

DH is dead when resources become available for the second hero. Hero revival and hero recruitment both become urgent expenses.

#### 3.15 — Human's army composition changes after hero selection

A hero is purchased based on previously observed Human forces, but subsequent scouting reveals a different unit composition or strategy. The assumptions behind the purchase no longer hold.

#### 3.16 — Human's expansion is exceptionally vulnerable

An exposed, lightly defended Human expansion is discovered just as the second hero becomes available. The immediate opportunity differs from the expected independent creeping phase.

### Scenario 4 — Independent creeping with the second hero and Archers

Approximately five Archers and the second hero begin creeping separately from DH. The Ancient of War joins after completing the last Archer, providing additional support against neutral camps.

#### 4.1 — Last Archer has not finished training

The main army is ready to begin creeping, but the Ancient of War remains rooted because Archer production is still in progress.

#### 4.2 — Ancient of War is badly damaged

Earlier creeping or combat left the Ancient of War with little health. Its ability to safely participate in another creep encounter is questionable.

#### 4.3 — Ancient of War is attacked while moving

The uprooted Ancient encounters enemy units before reaching its intended creeping location. It is vulnerable while separated from the supporting army.

#### 4.4 — Ancient of War cannot reach the desired camp

Trees, narrow paths, cliffs, or other terrain restrictions prevent the large Ancient from reaching the planned position.

#### 4.5 — Planned creep camp has already been cleared

Human has taken the intended creep camp. The second hero and Archers arrive to find no experience or item reward.

#### 4.6 — Creep camp is stronger than the current army can handle

The selected camp deals unexpectedly high damage or contains dangerous neutral abilities. The small Archer-based army is at significant risk.

#### 4.7 — Creep engagement starts incorrectly

A creep pull goes wrong, units become separated, or multiple groups of neutral creeps become involved. The engagement is substantially harder than expected.

#### 4.8 — Human arrives during creeping

An enemy hero and army appear while the second hero, Archers, and Ancient of War are fighting creeps. The Night Elf forces can be caught in a weakened or badly positioned state.

#### 4.9 — Human competes for the same creep camp

Both armies approach a valuable neutral camp. Neither side has uncontested access to the experience and item.

#### 4.10 — The second hero is focused by enemy units

The low-level Naga or Panda takes concentrated damage from enemy heroes or ranged units. The army's central hero becomes endangered.

#### 4.11 — Several Archers are killed

The army loses a significant share of its ranged damage while creeping or fighting the enemy. Subsequent camps become more dangerous.

#### 4.12 — Human Footmen have Defend

Enemy Footmen use Defend against the Archer-heavy army, substantially reducing incoming piercing damage and potentially reflecting attacks.

#### 4.13 — Water Elementals overwhelm the Archer force

The Human army arrives with powerful summoned Water Elementals that absorb damage and threaten fragile Archers.

#### 4.14 — Human Riflemen focus vulnerable Archers

An encounter with Riflemen causes rapid losses among the Night Elf ranged units. The army is particularly vulnerable when already damaged from creeping.

#### 4.15 — Human attacks the Night Elf base

The main army is creeping away from home when Human launches an attack on Moon Wells, Wisps, or Ancients of Lore.

#### 4.16 — Demon Hunter needs help during harassment

DH encounters a dangerous Human army or an opportunity requiring additional damage. The independently creeping army is operating elsewhere.

#### 4.17 — Valuable neutral opportunities appear elsewhere

A nearby Mercenary Camp, item-bearing creep camp, or exposed enemy creep encounter presents a different opportunity from the original route.

#### 4.18 — The second hero reaches the desired experience earlier than expected

Favorable creep encounters provide enough experience for the second hero to reach the intended level before the planned route is finished.

### Scenario 5 — DH reunites with the army for joint creeping

After the second hero reaches approximately level 2–2.5, DH joins the Archers and second hero. The combined army creeps toward level 3 and continues gaining experience while waiting for bears, provided the situation remains safe.

#### 5.1 — Demon Hunter is still engaged in valuable harassment

DH has found the Archmage or vulnerable Human workers and is actively inflicting damage. Leaving immediately would abandon an ongoing opportunity.

#### 5.2 — Demon Hunter cannot safely disengage

DH is being pursued, surrounded, or otherwise pressured by Human forces. Reaching the main army is not straightforward.

#### 5.3 — Demon Hunter is killed before rejoining

DH dies while operating independently. The combined army is missing its first hero.

#### 5.4 — Second hero dies before reunification

Naga or Panda dies while creeping with Archers. DH has no living second hero to join.

#### 5.5 — Second hero has not reached the expected level

Poor creeping results, enemy interference, or earlier unit losses leave the second hero substantially below the planned experience level.

#### 5.6 — Second hero is already close to level 3

The second hero is nearing the next level just as DH becomes available. Joining the heroes changes how experience from subsequent creeps is shared.

#### 5.7 — Demon Hunter is underleveled

DH has spent considerable time harassing without gaining much experience. His level is noticeably lower than expected for this stage of the game.

#### 5.8 — Heroes are on opposite sides of the map

DH is operating near the Human base while the second hero is creeping elsewhere. Combining the groups requires a substantial journey.

#### 5.9 — Staff of Teleportation is unavailable for immediate travel

DH's Staff is on cooldown, has been sold, or is otherwise unavailable. The planned quick relocation cannot happen.

#### 5.10 — Human intercepts one group before reunification

Human discovers either DH or the Archer army while they remain separated. One group is forced into combat without the other's support.

#### 5.11 — Nearby creep camps are exhausted

Most accessible creep camps have already been cleared by either player. The combined army has few remaining opportunities for safe experience.

#### 5.12 — Remaining creep camps are dangerous

The available neutral camps contain powerful creeps or occupy locations where the Human army can easily interfere. Continuing to level heroes carries considerable risk.

#### 5.13 — Human contests the next creep camp

The Human army arrives at the same camp as the combined Night Elf force. The planned PvE encounter becomes a possible major battle.

#### 5.14 — Human launches a timing attack

A substantial Rifleman, Caster, or mixed army moves toward the Night Elf base before the expected bear timing. Joint creeping is interrupted by an immediate military threat.

#### 5.15 — A new Human expansion is discovered

Scouting reveals another expansion attempt while the combined army is creeping. A potentially vulnerable economic target is available.

#### 5.16 — Both heroes are wounded or lack mana

Previous engagements leave DH and the second hero in poor condition. The army has sufficient units but its heroes are not prepared for a dangerous creep camp or battle.

#### 5.17 — Moon Wells are depleted

The heroes return or approach the main base expecting healing, but Moon Wells have insufficient mana. Health and mana recovery are slower than anticipated.

#### 5.18 — Human army becomes unexpectedly weak

Human suffers a disastrous creep encounter, loses a hero, or retreats after heavy combat losses. The opponent is temporarily vulnerable even though bear production is incomplete.

### Scenario 6 — Bear timing and attack on the Human expansion

Tier 3 and Druid of the Claw Master Training are complete, enabling Bear Form. The Night Elf gathers its army and attacks the Human expansion, expecting to exploit the new army's strength.

#### 6.1 — Human never built an expansion

Scouting confirms that Human has remained on one base. The intended expansion target does not exist.

#### 6.2 — Human expansion was destroyed earlier

Previous harassment or combat has already eliminated the expansion. The planned objective has disappeared before the bear timing.

#### 6.3 — Human moved its expansion to another location

The previously scouted expansion was canceled or abandoned, while a new Town Hall was constructed elsewhere. The original target is no longer economically important.

#### 6.4 — Human controls multiple expansions

The opponent has established two or more additional bases. Destroying one expansion may leave substantial Human income intact.

#### 6.5 — Bears are unlocked but very few exist

Master Training has completed, but only a small number of Druids of the Claw are available. The army has technically reached its intended upgrade without reaching the expected fighting strength.

#### 6.6 — Ancients of Lore have been destroyed

One or both Ancients of Lore were lost before or during the Tier 3 transition. Druid production is severely reduced despite access to the necessary technology.

#### 6.7 — Human attacks before Master Training completes

Human launches a strong Rifleman/Caster timing attack shortly before the final upgrade finishes. The Night Elf must fight without its intended Bear Form advantage.

#### 6.8 — Human expansion is protected by many towers

Multiple Guard Towers and Arcane Towers cover the Town Hall, Peasants, and surrounding approaches. The attack faces substantial static defenses.

#### 6.9 — Human uses extensive Peasant repairs

Peasants repair towers and the Town Hall while the Night Elf army attacks. Structures survive much longer than expected.

#### 6.10 — Human defends with Militia

Workers are converted into Militia to reinforce the army defending the expansion. The number of combatants rises rapidly.

#### 6.11 — Human teleports its main army to the expansion

A Scroll of Town Portal brings Human heroes and units to the threatened base. The Night Elf suddenly faces the main opposing army alongside expansion defenses.

#### 6.12 — Human relies on Riflemen and Sorceresses

Riflemen concentrate ranged damage while Sorceresses apply Slow to the bears. The Night Elf's powerful melee units struggle to reach their intended targets.

#### 6.13 — Human fields numerous Priests

Human's army contains enough Priests to restore substantial health during engagements. Targets that appear close to death can survive through repeated healing.

#### 6.14 — Human fields Spell Breakers

Spell Breakers steal beneficial magic such as Rejuvenation and Roar and threaten the mana of nearby spellcasters. The bear army's magical support becomes less reliable.

#### 6.15 — Mountain King threatens the Night Elf heroes

Mountain King uses Storm Bolt against vulnerable heroes and Thunder Clap against clustered units. The combined army can suffer significant damage and disruption in close combat.

#### 6.16 — Archmage uses Blizzard against the army

The Archmage uses Blizzard on concentrated Archers, Druids, or bears. The attack threatens multiple units simultaneously, especially in restricted positions.

#### 6.17 — Human has transitioned into Gryphon Riders

Scouting reveals a substantial flying army. Bears cannot attack these units, and the remaining Night Elf anti-air capability may be insufficient.

#### 6.18 — Human fields Mortar Teams

Mortar Teams attack from behind the Human frontline or towers. Their siege damage threatens Archers, Dryads, and Night Elf structures.

#### 6.19 — Human uses Siege Engines against the Night Elf base

Human Siege Engines move toward the Night Elf main base while the bear army operates elsewhere. Important buildings face a threat that bears attacking the expansion cannot immediately stop.

#### 6.20 — Human attacks the Night Elf main base during the offensive

Instead of defending the expansion with its entire army, Human attacks the Night Elf production infrastructure. Both players threaten each other's economies and buildings simultaneously.

#### 6.21 — Human expansion is protected by difficult terrain

Towers, buildings, trees, and narrow entrances restrict the bear army's movement. Only a fraction of the melee units can reach and attack useful targets at once.

#### 6.22 — Human has a significantly larger army

Additional expansion income allowed Human to accumulate considerably more units than expected. The Night Elf reaches bears but is heavily outnumbered.

#### 6.23 — Human has already lost its main army

An earlier engagement left Human with very few surviving combat units. The originally planned timing no longer corresponds to the opponent's actual strength.

#### 6.24 — Human changes composition during the attack

The Night Elf begins attacking an army of Footmen and Riflemen but encounters newly produced Spell Breakers, Casters, Knights, or flying units. The battle develops differently from the initial scouting information.

#### 6.25 — One Night Elf hero is killed before the attack

DH or the second hero dies in an encounter shortly before the assault. The bear army has lost an important part of its intended combat strength.

#### 6.26 — Night Elf army suffers serious losses while approaching

Human intercepts the approaching army, or it becomes divided and loses several units before reaching the expansion. The army arriving at the target is weaker than the one originally assembled.

#### 6.27 — The expansion's gold mine is nearly depleted

The Human expansion has been mining for a long time and its remaining gold is low. Its economic importance differs from that of a recently constructed expansion.

#### 6.28 — Human evacuates the expansion

Peasants leave the threatened expansion, transferring to another base or moving elsewhere. The expansion loses much of its immediate economic activity before the Night Elf destroys its structures.

#### 6.29 — Human attacks Night Elf reinforcements

Human units intercept newly produced Druids or other reinforcements traveling from the main base. The attacking army receives fewer replacements than expected.

#### 6.30 — The first assault causes heavy bear casualties

The Night Elf breaks some defenses but loses several expensive bears and leaves other units badly wounded. The continued viability of the attack becomes uncertain.

#### 6.31 — Human loses its defending hero

The Archmage, Mountain King, or another important Human hero dies early in the expansion defense. The battle's balance changes significantly before the expansion itself is destroyed.

#### 6.32 — A new target becomes exposed during the attack

Human moves most of its military forces to the expansion, leaving an important production building, another expansion, or the main base weakly defended.

#### 6.33 — Human launches a counterattack after losing the expansion

The expansion falls, but the surviving Human army advances toward the Night Elf main base or another vulnerable position. Destroying the intended target has not ended the immediate military threat.

#### 6.34 — Human remains economically stronger after losing the expansion

Despite the successful attack, Human retains another operating gold mine, a larger army, or more established production infrastructure. The expected strategic advantage from destroying the expansion does not materialize.
