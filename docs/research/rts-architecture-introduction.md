# Research: Introduction to the Proposed Architecture

Status: a tutorial introduction to the research proposal in [`rts-behavior-architecture.md`](rts-behavior-architecture.md), second iteration. The proposal is not the adopted architecture; that remains [`ARCHITECTURE.md`](../ARCHITECTURE.md). Where this introduction and the proposal disagree, the proposal is right.

This introduction builds the proposed architecture up one idea at a time, following one moment of one game. It explains what each part is for and how the parts work together, and links to the proposal for the exact rules. It assumes you know TypeScript and the basics of Warcraft III, but not BDI.

## 1. The problem

A Warcraft III player decides continuously, at every scale at once, often in under a second: which strategy to follow, whether to harass or creep, which unit to focus, when a wounded hero must run. Plans break constantly. A camp is already cleared, the enemy expands, the base is attacked while the hero is away. A good player keeps the purpose, changes the means, and reacts at the right level.

The bot must do the same under three constraints:

- **Fair information.** It sees only what a player could see.
- **Explainability.** For every decision, it must be possible to say why it was made.
- **Testability.** Almost everything must run in tests, without the game.

## 2. The big picture

The architecture is built on BDI:

- **Beliefs** are what the bot holds true: what it sees, remembers, and infers.
- **Desires** are what would be worth achieving now. Wanting is not committing; most Desires are never acted on.
- **Intentions** are what the bot has committed to, and how it pursues each commitment.

Between Beliefs and Desires sit **Assessments**: what the Beliefs mean for the bot, such as whether a base is threatened. Like Beliefs, they are information; [section 5](#5-interpreting-assessments) explains them.

An RTS needs two answers that BDI frameworks do not give: who gets which units and money when commitments compete, and how a commitment becomes an order for each of many units. The bot therefore answers five questions, each in one place:

| Question                                                                             | Answered by                                                      |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **Know**: what is true, was seen, or is probably true, and what does it mean for us? | Beliefs and Assessments                                          |
| **Want**: what would be worth achieving now?                                         | Desires                                                          |
| **Commit**: what do we pursue, and in which order?                                   | Deliberation, which adopts Intentions and orders them            |
| **Allocate**: who gets which units, gold, lumber, and food?                          | Allocation                                                       |
| **Act**: how is each commitment carried out, unit by unit?                           | the execution chain, from an Intention down to each unit's order |

Many Intentions run at once: the economy, supply, scouting, a harassment. They never call each other. They compete for units and money through Allocation, and everything else they need to know is in Beliefs.

All this reasoning happens in one **mind**, plain TypeScript over plain data, between two thin boundaries:

```text
Warcraft ──▶ Perception ──▶ mind ──▶ order executor ──▶ Warcraft
                             │
                             └──▶ decision record
```

- **Perception** is the only code that reads Warcraft. It turns what the bot can see into observations and filters by visibility, which is where fair information is enforced.
- **The order executor** is the only code that issues Warcraft orders.
- **The mind** never holds Warcraft handles: units are named by ids. Game time arrives with the observations, randomness comes from one seeded source, and static knowledge is handed over when the mind is created.

That one boundary does three jobs. It enforces fair information, it lets tests feed observations and read orders without the game, and it gives one place where every decision and its reason can be recorded.

Details: [One mind, two boundaries](rts-behavior-architecture.md#41-one-mind-two-boundaries).

## 3. The running example

The rest of this introduction follows one moment of a Night Elf versus Human game, the proposal's [first walkthrough](rts-behavior-architecture.md#61-the-demon-hunters-harassment-interrupted-twice).

The Night Elf plays the Fast Bears strategy. Its Demon Hunter carries a Staff of Teleportation and is harassing the Human Archmage. Then:

1. A scouting Wisp sees a Human Town Hall under construction.
2. While the Demon Hunter raids it, Human Footmen attack the Wisps at home.
3. The Footmen die, and the bot goes back to what it was doing.

Each of the next sections explains one part of the architecture through this story.

## 4. Knowing: Beliefs and Knowledge

When the Wisp spots the Town Hall, the bot's Beliefs include:

- its own units: the Demon Hunter with his life, mana, cooldowns, and the Staff; the Wisps and where they work; gold, lumber, and food;
- the Archmage, last seen 40 seconds ago near the north camp. This is a **contact**: a record of what was seen, where, and when, not the Archmage himself. Where he is now is an estimate, built from the sighting and from camps found cleared;
- the Town Hall, just seen, and what the bot concludes from it: the enemy is making a fast expansion. The conclusion comes from **plan recognition**, which compares what was seen with a library of known enemy strategies. Each strategy has signs, called fingerprints: small rules over what was seen and when, such as "an enemy Town Hall built away from its start before 5:00". Seen at 15:00, the same building would be an ordinary expansion. The conclusion is a Belief with a confidence, because it may be wrong.

Beliefs are one world model in plain data. Small pure functions, the belief models, revise their parts from the previous Beliefs and the new observations; nothing else writes to Beliefs. Three rules keep them honest:

- **Contacts, not actors.** Beliefs never hold enemy units, only what was seen and inferred. A remembered position stops counting once that place is seen empty.
- **Uncertainty stays visible.** Inferred facts carry their confidence and age.
- **Derived facts are filtered once.** A fact such as "the base is threatened" gets its hysteresis where it is inferred, so that everything reading it sees the same stable answer.

**Knowledge** is everything known before the game starts. Game data (costs, build times, damage tables, requirements) and map knowledge (regions, chokes, routes, creep camps, shops) come from build-time tooling and are handed to the mind when it is created. Pure Knowledge functions compute what all parts must agree on, such as the combat estimate and travel time. When the raid asks whether the Demon Hunter can reach the Town Hall before it is finished, it uses the same build time and travel time as every other part of the bot.

Details: [Beliefs and Knowledge](rts-behavior-architecture.md#43-beliefs-and-knowledge), [The enemy model](rts-behavior-architecture.md#412-the-enemy-model).

## 5. Interpreting: Assessments

Beliefs say what is true. **Assessments** say what it means for the bot. Five Footmen at the Wisps are a fact; whether they are a serious threat depends on what defends the Wisps. That judgment belongs to the threat assessment.

Right after the Wisp's sighting, the threat assessment finds no threat to any base, and the danger assessment rates the route to the north expansion safe enough for the Demon Hunter.

An interpretation becomes an assessment when several parts need it and must agree on it: the threat to a base, danger by region, relative army strength, map control. An interpretation only one module needs stays inside that module as a private **judgment**, such as a Tactic's view of its own fight.

Like Beliefs, Assessments are plain data, updated right after the Beliefs they read, every tick or more slowly. Neither of them creates Desires. They are information, which the desire sources read:

```text
observations ─▶ Beliefs ─▶ Assessments
                   │            │
                   └─ read by ──┘
                        ▼
concerns, playbook, requests ─▶ Desires
```

Which plan the enemy follows is a claim about the world, so recognizing it belongs to Beliefs, as in the previous section. Whether that plan beats ours is an assessment.

Details: [Assessments](rts-behavior-architecture.md#44-assessments).

## 6. Wanting: Desires

A **Desire** is an outcome the bot considers worth pursuing: `DefendBase{main}`, `AcquireItem{Demon Hunter, Staff}`, `RaidBase{north expansion}`. A Desire commits to nothing, and Desires are cheap: they are recomputed every deliberation cycle, about once a second.

Each cycle, the mind asks three sources for proposals:

- **Concerns**, what any competent player keeps caring about all game: safe bases, living heroes, supply ahead. BDI literature calls them maintenance goals. Each reads Beliefs and Assessments, and proposes a Desire when a condition breaks, or is about to.
- **The playbook**, what the current game plan wants. In its Harass phase, Fast Bears proposes, in falling weight, buying the Staff, harassing the enemy hero, and creeping with the Demon Hunter.
- **Requests** from active Intentions, for what a commitment needs, such as an item or help. A request disappears with the Intention that made it.

Each proposal carries a **rank**, a **weight**, and a **reason**. The rank is a category, from Survival down to Background: a threat the threat assessment rates lethal is Survival, a serious one is Emergency, the game plan's own goals are Game plan, and so is a small threat such as a lone Footman at the Wisps; a short-lived gain is usually an Opportunity, and upkeep that is never urgent is Background. The weight is the value within the rank, computed from Beliefs and Assessments; a weight of 0 vetoes the proposal. A higher rank always comes first, and weight orders proposals within a rank.

Right after the sighting, the bot wants this:

| Desire                      | Source                                   | Rank      | Weight | Reason                                           |
| --------------------------- | ---------------------------------------- | --------- | ------ | ------------------------------------------------ |
| `RaidBase{north expansion}` | the playbook's fast-expansion adaptation | Game plan | 0.85   | fast expansion seen; the Town Hall is unfinished |
| `HarassEnemyHero{Archmage}` | the playbook's Harass phase              | Game plan | 0.6    | the Harass phase                                 |
| `Creep{Demon Hunter}`       | the playbook's Harass phase              | Game plan | lower  | the Harass phase                                 |

The raid is a short-lived chance, so its proposal carries a **window**: it is worth something only until the Town Hall is finished. If the Demon Hunter could not get there in time, its weight would drop to 0 and the Desire would disappear without anyone canceling it.

There is no Desire to defend the base yet, because nothing threatens it. One will appear the moment the threat assessment says otherwise, since concerns are asked every cycle.

A proposal is plain data:

```ts
// A proposal (sketch).
const raidProposal = {
  outcome: { kind: 'RaidBase', base: northExpansion },
  rank: RANK.GAME_PLAN,
  weight: 0.85,
  reason: 'fast expansion seen; Town Hall unfinished',
};
```

Details: [Desires](rts-behavior-architecture.md#45-desires).

## 7. Committing: Deliberation and Intentions

**Deliberation** turns Desires into **Intentions**: commitments the bot pursues until they are achieved, become impossible, or are no longer wanted. Each cycle it:

1. checks every active Intention's conditions: achieved, impossible, or out of context;
2. adopts an Intention for each valid Desire that has none;
3. orders the agenda: by rank, then by weight;
4. records the reasons for all of it.

In the example, Deliberation adopts the raid. The agenda now reads: the raid (Game plan, 0.85), the harassment (Game plan, 0.6), creeping (Game plan, lower).

An Intention is **relative to the reason it was adopted for**. When its Desire disappears, the Intention is dropped, unless it is in a step that must not be interrupted, such as a purchase being made. Nobody has to remember to cancel it.

**Intention kinds.** Every Intention belongs to a kind, which declares:

- **conditions over Beliefs**: when the goal is achieved, when it is impossible, and when it cannot be pursued now;
- **methods**, the alternative ways to pursue it (BDI's _Plans_), each with a precondition and a preference;
- **requests**: Desires for its subgoals;
- **a failure policy**: how long a failed method is excluded, how many attempts are allowed, and then whether to retry later or fail.

One small generic runtime chooses the method and handles failure, so kinds do not reimplement it. The raid's method might be "hit the workers": travel, kill the builders and Peasants, and leave before defenders arrive. The harassment's method is hit and run: search, engage, disengage, recover.

**State.** An Intention is active, paused, or finished, and its progress is idle, starved, or running, each with a reason. The harassment is about to be **starved**: still adopted and still wanted, but without the Demon Hunter. It keeps its state. When it gets him back, its method works out where it stands from Beliefs instead of replaying from where it stopped.

Details: [Deliberation](rts-behavior-architecture.md#46-deliberation), [Intentions](rts-behavior-architecture.md#47-intentions).

## 8. Allocating: who gets the Demon Hunter

Both the raid and the harassment need the Demon Hunter. **Allocation** is the only owner of units and money, and it decides.

Each Intention declares its **needs**: which units (a given hero, unit types, or a class such as army), how many (a count with a minimum and a maximum, or the fighting strength required), which it prefers (closest, healthiest, already held), and how much gold, lumber, and food. Each round, Allocation walks the agenda in order and serves the needs. It takes only what a need asks for, preferred units first: a defense against one Footman takes the nearest Archer, not a hero from across the map.

A unit moves from one Intention to another only by the **switching rule**:

- nothing moves out of a step marked uninterruptible, such as a Town Portal about to take effect;
- otherwise, a challenger with a higher rank wins;
- a challenger with the same rank wins only by a margin: a commitment constant plus the holder's **interruption cost**, what interrupting the holder now would waste.

The raid and the harassment have the same rank, so the margin applies. The harassment is fighting the Archmage and reports that as its interruption cost: 0.1 for an engagement under way. With a commitment constant of 0.05, the raid needs a weight above 0.6 + 0.15 = 0.75. It has 0.85, so the Demon Hunter moves to the raid, and the decision record keeps every term of the comparison.

Interruption costs are named losses, such as "an engagement under way" or "a camp half cleared", not bare numbers. That keeps Intentions written by different people on one scale.

A few more rules complete the picture:

- **Needs are declared again every round.** An Intention that stops needing a unit simply loses it.
- **Every unit has one owner.** Units nobody asked for go to default owners: workers to RunEconomy, army units and heroes to Reserve.
- **Every starvation has a named cause:** a higher Intention that was served, or a holder the switching rule protected.

Money works the same way. It is reserved in agenda order, against the stock plus a short projection of income. That is how the bot saves: an unmet need reports when it will become affordable, and spending lower on the agenda waits.

Details: [Allocation](rts-behavior-architecture.md#48-allocation).

## 9. Acting: from commitment to orders

The raid now owns the Demon Hunter. What it wants from him passes down a short chain:

```text
Intention        RaidBase{north expansion}
  Method         hit the workers: travel → strike → leave
    Tactic       Siege around the unfinished Town Hall: builders first
      Directive  Demon Hunter: Engage(the building Peasant), role Harasser, retreat at 45 % life
        Unit Behavior (Demon Hunter): reflexes, then skills, opportunities, task
          Order  attack the Peasant
```

- **Method**: one way to pursue the Intention, written as a small state machine. It runs Tactics for its groups.
- **Tactic**: a reusable controller for a group: Travel, Skirmish, CreepCamp, HitAndRun, Siege, Hold, Recover. It keeps its group's fight-or-flight state between updates, with separate thresholds for engaging and disengaging so that it does not flip back and forth, and it picks targets and positions. Here, the Siege Tactic puts builders first.
- **Directive**: what is asked of one unit, from a closed vocabulary: a task, a role (how to play it), and latitude (how far the unit may deviate: retreat threshold, opportunism, leash). Directives are constraints, not micromanagement.
- **Unit Behavior**: every own unit has one, chosen by its unit type. Each tick it runs **reflexes** first, which may override the Directive to keep the unit alive. Then it tries **skills** (abilities and items, as the role suggests), **opportunities** (within the latitude), and finally the **task**. It returns one order and the reason for it.

Roles, not unit types, decide how a unit plays: the same Demon Hunter burns the Archmage's mana as a Harasser and the casters' mana as Damage. The order goes to the order executor, which skips it if the unit is already doing exactly that.

**Opportunities at every level.** Whoever sees a chance, such as a dying creep in range or a lone Peasant on the way, takes it if its value beats the detour, the risk, and what it interrupts, within the latitude it was given. A Unit Behavior takes a last hit, a Tactic finishes a wounded camp, a method takes a camp on its route, and anything bigger becomes a Desire that competes on the agenda. A scout's Directive allows free opportunism; the Wisp walking to the Tavern allows none.

Details: [Execution](rts-behavior-architecture.md#49-execution), [Opportunities and latitude](rts-behavior-architecture.md#410-opportunities-and-latitude).

## 10. The twist: an attack at home

While the Demon Hunter raids, five Human Footmen reach the Wisps.

1. **Reflexes first.** The Wisps flee on the next tick. Their owner, RunEconomy, does not change: reflexes work whoever owns the unit.
2. **A new Desire.** Beliefs now hold five Footmen at the Wisps. The threat assessment weighs them against what defends the Wisps, two Archers and the Ancient of War, and rates the threat to the main base serious. The base-safety concern reads that and proposes `DefendBase{main}`, rank Emergency, and the new threat runs Deliberation on the next tick instead of waiting for the cycle.
3. **A defense sized to the threat.** DefendBase needs strength above the threat, arriving within 20 seconds, and Allocation fills that need nearest first. The two Archers and the Ancient of War at home are not enough against five Footmen, so the need also reaches the Demon Hunter, whose Staff lets him arrive in time. Emergency outranks Game plan, so Allocation gives him to the defense; across ranks, no margin is needed.
4. **Acting.** The defense's method has him use the Staff, and the Hold Tactic fights by the Moon Wells, focusing the Footmen.
5. **Back to normal.** The Footmen die, the threat assessment clears the threat, and the base-safety concern stops proposing, so DefendBase is achieved. The Peasants at the expansion have fled, so the raid's target is gone and it fails with that reason. The harassment is re-checked, finds the playbook still proposing it and the Archmage alive, and gets the Demon Hunter back. Its method resumes from Beliefs: from where the Archmage was last seen.

**The size of the threat decides who comes.** Had a lone Footman come, the units at home would have met the need, and the Demon Hunter would have stayed on the raid. With nobody at home, the threat assessment would rate a lone Footman small, so it would be ranked Game plan, and the Wisp or two it threatens would not outweigh the raid's switching margin: the Wisps would flee, and the raid would go on. Recalling a hero for a small threat wastes more than it saves.

No Intention told another anything. Every switch came from Beliefs, Desires, the agenda, and Allocation, and each one has a recorded reason.

## 11. One tick, end to end

Every tick, ten times a second, runs the same phases:

| Phase                                                                       | Runs                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------- |
| 1. Perception observes; belief models revise Beliefs, then Assessments      | every tick                                     |
| 2. Concerns, the playbook, and requests propose Desires                     | about once a second, or early on urgent events |
| 3. Deliberation checks conditions, adopts Intentions, and orders the agenda | with phase 2                                   |
| 4. Allocation serves needs in agenda order                                  | with phase 2, and when units appear or die     |
| 5. Intentions step their methods, and Tactics produce Directives            | each at its own pace                           |
| 6. Each Unit Behavior decides its unit's order                              | every tick, within a budget                    |
| 7. The decision record keeps what was decided and why                       | every tick                                     |

Each phase reads only Beliefs and what earlier phases produced. No part relies on another having run first, an ordering that kept producing bugs in Steamhammer. Slow work runs less often: Deliberation about once a second, Tactics several times a second, and reflexes every tick.

Details: [A tick, phase by phase](rts-behavior-architecture.md#42-a-tick-phase-by-phase), [Timing and budgets](rts-behavior-architecture.md#413-timing-and-budgets).

## 12. The game plan: playbooks

The strategy itself is data. The strategy concern proposes executing the playbook it prefers, given the matchup and the recognized enemy plan. There is one playbook at a time. The strategy concern switches playbooks when no adaptation of the current one answers the enemy well enough, and switching needs a clearly better score and a minimum time on the current one.

The concern only wants a playbook; Deliberation commits to it. Its Desire, `ExecuteStrategy{playbook}`, becomes an Intention like any other: the committed strategy. That Intention keeps the playbook's current phase, and the playbook's rules propose the Desires that carry the strategy out, such as `TrainHero{Demon Hunter}` or `Attack`. They compete on the agenda with every other Desire, so a threat at home still outranks the plan. Fast Bears is one playbook; a Human tower rush would be another.

A playbook holds:

- **phases** with entry conditions, each proposing Desires. Fast Bears has Opening, Harass, Second hero, Reunite, and Bear timing;
- **an opening book** in a small language: `'5 x wisp'`, `'altar of elders'`, `'go scout enemy start'`;
- **production goals** as desired totals, so recomputing a Desire never builds twice;
- **adaptations**: rules on the recognized enemy plan, other Beliefs, and Assessments that change ranks and weights, or add and withdraw Desires. They scale with the recognition's confidence. Expectations are adaptations that guard the plan's own assumptions, such as "no air units before 8:00";
- **hero skill and item builds**, and style knobs such as aggression.

In the example, the harassment exists because of the Harass phase, and the raid because of the fast-expansion adaptation. Changing how the bot plays Night Elf versus Human means editing its playbook, not the machinery.

Details: [Strategy, playbooks, and production](rts-behavior-architecture.md#411-strategy-playbooks-and-production).

## 13. Seeing why: the decision record

Each tick produces one record of plain data:

- the Assessments that changed, with their inputs;
- the Desires and their proposals, with ranks, weights, and reasons;
- the Intentions adopted, paused, or finished, and why;
- the agenda, and Allocation's grants and denials with the terms of the switching rule;
- each method's phase, each Tactic's status, and the Directives;
- each unit's chosen module and its reason, and the orders.

The same record feeds the in-game overlay (status text over units), logs, traces of end-to-end tests, and assertions in behavioral tests. In the example, it answers "why did the Demon Hunter leave the Archmage?" with the raid's 0.85 against the harassment's 0.6, plus 0.05 for commitment and 0.1 for the engagement under way.

Details: [The decision record](rts-behavior-architecture.md#414-the-decision-record).

## 14. Testing

Because the mind takes plain data in and gives plain data out, the story above is also a test scenario:

- a small Knowledge fixture: a map with a main base, an expansion site, and a creep camp, and the handful of unit types involved;
- the initial state: the Demon Hunter with the Staff, Archers, the Ancient of War, and Wisps;
- a timeline of observations: a Town Hall seen under construction, then Footmen near the Wisps.

A test creates a fresh mind with a seeded random source, steps it through the timeline, and checks the decision record at the coarsest level that pins the behavior: the raid takes the Demon Hunter, the defense takes him away, and the harassment gets him back. The same scenario with a lone Footman checks that the defense leaves him on the raid. Each step can also be tested alone: an assessment from given Beliefs, or Desires from given Assessments, without simulating how a threat was detected. Warcraft is never involved. End-to-end tests run the same mind in the game, with the real Perception and order executor, on a test map.

Details: [Testability](rts-behavior-architecture.md#5-testability).

## 15. Where a new behavior goes

Put a behavior at the lowest level that has the information and the authority it needs:

| To add                                                                            | Put it in                              |
| --------------------------------------------------------------------------------- | -------------------------------------- |
| Naga casts Mana Shield when focused                                               | a skill in Naga's Unit Behavior        |
| Workers flee from danger                                                          | a reflex in the worker's Unit Behavior |
| The army kills Priests first                                                      | a Tactic's kill order                  |
| Creeping with the Ancient of War as a tank                                        | a method of the Creep Intention kind   |
| A new kind of operation, such as an escort                                        | a new outcome kind and Intention kind  |
| Raiding when the enemy expands early                                              | an adaptation in the playbook          |
| Defending a threatened base, as any player would                                  | a concern                              |
| What a situation means, needed by several parts, such as a threat to an expansion | an Assessment                          |
| Recognizing a new enemy strategy, such as a proxy                                 | an entry in the strategy library       |
| Inferring a new fact, such as the enemy's tech                                    | an inference rule in Beliefs           |
| How long a Town Hall takes to build                                               | Knowledge                              |

The full list is in [Where a new behavior goes](rts-behavior-architecture.md#7-where-a-new-behavior-goes).

## 16. What is still open

The proposal is research, and parts of it are unproven:

- every fight-or-flight decision depends on a combat estimate that still has to be calibrated;
- some facts the scenarios need, such as shop and Tavern stock, may not be readable through natives;
- item and ability orders need verifying in the game, one by one;
- the format of the map data from the build tooling is not defined yet;
- launching Warcraft III into a test map automatically is unverified.

See [Risks and open questions](rts-behavior-architecture.md#10-risks-and-open-questions) and [Where the coverage is thin](rts-scenario-analysis.md#where-the-coverage-is-thin).

## 17. Glossary

- **Adaptation**: a playbook rule on inferred Beliefs that changes ranks and weights, or adds and withdraws Desires.
- **Agenda**: the active Intentions, ordered by rank and then weight. Allocation serves needs in this order.
- **Allocation**: the only owner of units and money. It serves needs in agenda order.
- **Assessment**: what Beliefs mean for the bot, shared by every part that needs it, such as the threat to a base. It is computed after Beliefs and, like them, never proposes Desires.
- **Beliefs**: the bot's world model, in plain data: what it holds true, has seen, or infers.
- **Concern**: something the bot keeps caring about all game, such as safe bases; BDI literature calls it a maintenance goal. It reads Beliefs and Assessments, and proposes a Desire when a condition breaks or is about to.
- **Contact**: a Belief about an enemy unit or structure: what was seen, where, when, and how it is known.
- **Decision record**: one record per tick of what was decided and why.
- **Default owner**: the Intention that receives units nobody asked for: RunEconomy for workers, Reserve for army units and heroes.
- **Deliberation**: checks Intentions' conditions, adopts Intentions for Desires, and orders the agenda.
- **Desire**: an outcome worth pursuing, with the proposals that support it. It commits to nothing.
- **Directive**: what is asked of one unit: a task, a role, latitude, and optionally where to stand and where to fall back.
- **Fingerprint**: a sign of an enemy strategy in the strategy library: a small rule over what was seen and when, such as an early Town Hall away from the enemy's start.
- **Intention**: a commitment to a Desire, pursued through methods until it is achieved, becomes impossible, or is no longer wanted.
- **Intention kind**: the declaration behind Intentions of one sort: conditions, methods, requests, and a failure policy.
- **Interruption cost**: what interrupting an Intention now would waste, given by name. It is part of the switching margin.
- **Judgment**: an interpretation only one module needs, such as a Tactic's view of its own fight. It stays private in that module.
- **Knowledge**: static game data and map knowledge, prepared offline and supplied when the mind is created.
- **Latitude**: how far a unit may deviate from its Directive: retreat threshold, opportunism, leash.
- **Method**: one way to pursue an Intention: a small, re-entrant state machine. BDI calls it a Plan.
- **Mind**: all of the bot's reasoning, between Perception and the order executor. There is one per game.
- **Need**: what an Intention asks Allocation for: units, gold, lumber, or food.
- **Order executor**: the only code issuing Warcraft orders.
- **Perception**: the only code reading Warcraft state for decisions. It filters by visibility.
- **Plan recognition**: the inference that matches what was seen against a library of known enemy strategies, and gives the likeliest one or two with a confidence.
- **Playbook**: a strategy as data: phases, an opening book, production goals, adaptations, and builds.
- **Proposal**: a source's support for a Desire: a rank, a weight, and a reason.
- **Rank**: a proposal's category: Survival, Emergency, Game plan, Opportunity, or Background.
- **Reflex**: a Unit Behavior module that runs first and may override the Directive to keep the unit alive.
- **Request**: a Desire proposed by an active Intention for one of its subgoals.
- **Role**: how a unit should play its task, such as Harasser or Tank.
- **Starved**: the progress of an Intention whose needs go unmet. It keeps its state.
- **Switching rule**: when a unit may move between Intentions: never out of an uninterruptible step, always to a higher rank, and within a rank only by a margin.
- **Tactic**: a reusable controller for a group: fight or flight, targets, positions.
- **Unit Behavior**: one per own unit. It turns the unit's Directive into an order: reflexes, skills, opportunities, task.
- **Weight**: a proposal's value within its rank, computed from Beliefs. A weight of 0 vetoes the proposal.
- **Window**: how long an opportunity lasts. A Desire that can no longer fit its window gets weight 0.

## 18. Where to read next

- [`rts-behavior-architecture.md`](rts-behavior-architecture.md): the proposal, with every rule, sketches, more walkthroughs, and the roadmap.
- [`rts-scenario-analysis.md`](rts-scenario-analysis.md): how each deviation of the Night Elf versus Human scenarios fits the architecture.
- [`rts-research-sources.md`](rts-research-sources.md): what each studied bot and paper contributed.
