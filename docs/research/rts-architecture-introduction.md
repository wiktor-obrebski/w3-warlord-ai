# Research: Introduction to the Proposed Architecture

Status: a tutorial introduction to the proposed architecture (second iteration) described in the architecture document, [`rts-behavior-architecture.md`](rts-behavior-architecture.md). The proposed architecture is not the adopted one; that remains [`ARCHITECTURE.md`](../ARCHITECTURE.md). Where this introduction and the architecture document disagree, the architecture document is right.

This introduction builds the proposed architecture up one idea at a time, following one moment of one game. It explains what each part is for and how the parts work together, and links to the architecture document for the exact rules. It assumes you know TypeScript and the basics of Warcraft III, but not BDI. Terms of the architecture are set in _**bold italics**_; [the glossary](#17-glossary) defines them.

## 1. The problem

A Warcraft III player decides continuously, at every scale at once, often in under a second: which strategy to follow, whether to harass or creep, which unit to focus, when a wounded hero must run. Plans break constantly. A camp is already cleared, the enemy expands, the base is attacked while the hero is away. A good player keeps the purpose, changes the means, and reacts at the right level.

The bot must do the same under three constraints:

- **Fair information.** It sees only what a player could see.
- **Explainability.** For every decision, it must be possible to say why it was made.
- **Testability.** Almost everything must run in tests, without the game.

## 2. The big picture

The architecture is built on BDI:

- _**Beliefs**_ are what the bot holds true: what it sees, remembers, and infers.
- _**Desires**_ are what would be worth achieving now. Wanting is not committing; most _**Desires**_ are never acted on.
- _**Intentions**_ are what the bot has committed to, and how it pursues each commitment.

Between _**Beliefs**_ and _**Desires**_ sit _**Assessments**_: what the _**Beliefs**_ mean for the bot, such as whether a base is threatened. Like _**Beliefs**_, they are information; [section 5](#5-interpreting-assessments) explains them.

An RTS needs two answers that BDI frameworks do not give: who gets which units and money when commitments compete, and how a commitment becomes an order for each of many units. The bot therefore answers five questions, each in one place:

| Question                                                                             | Answered by                                                            |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Know**: what is true, was seen, or is probably true, and what does it mean for us? | _**Beliefs**_ and _**Assessments**_                                    |
| **Want**: what would be worth achieving now?                                         | _**Desires**_                                                          |
| **Commit**: what do we pursue, and in which order?                                   | _**Deliberation**_, which adopts _**Intentions**_ and orders them      |
| **Allocate**: who gets which units, gold, lumber, and food?                          | _**Allocation**_                                                       |
| **Act**: how is each commitment carried out, unit by unit?                           | the execution chain, from an _**Intention**_ down to each unit's order |

Many _**Intentions**_ run at once: the economy, supply, scouting, a harassment. They never call each other. They compete for units and money through _**Allocation**_, and everything else they need to know is in _**Beliefs**_.

All this reasoning happens in one _**mind**_, plain TypeScript over plain data, between two thin boundaries:

```text
Warcraft ──▶ Perception ──▶ mind ──▶ order executor ──▶ Warcraft
                             │
                             └──▶ decision record
```

- _**Perception**_ is the only code that reads Warcraft. It turns what the bot can see into _**observations**_ and filters by visibility, which is where fair information is enforced.
- **The _order executor_** is the only code that issues Warcraft orders.
- **The _mind_** never holds Warcraft handles: units are named by ids. Game time arrives with the _**observations**_, randomness comes from one seeded source, and static _**knowledge**_ is handed over when the _**mind**_ is created.

That one boundary does three jobs. It enforces fair information, it lets tests feed _**observations**_ and read orders without the game, and it gives one place where every decision and its reason can be recorded.

Details: [One mind, two boundaries](rts-behavior-architecture.md#41-one-mind-two-boundaries).

## 3. The running example

The rest of this introduction follows one moment of a Night Elf versus Human game, the architecture document's [first walkthrough](rts-behavior-architecture.md#61-the-demon-hunters-harassment-interrupted-twice).

The Night Elf plays the Fast Bears strategy. Its Demon Hunter carries a Staff of Teleportation and is harassing the Human Archmage. Then:

1. A scouting Wisp sees a Human Town Hall under construction.
2. While the Demon Hunter raids it, Human Footmen attack the Wisps at home.
3. The Footmen die, and the bot goes back to what it was doing.

Each of the next sections explains one part of the architecture through this story.

## 4. Knowing: Beliefs and Knowledge

When the Wisp spots the Town Hall, the bot's _**Beliefs**_ include:

- its own units: the Demon Hunter with his life, mana, cooldowns, and the Staff; the Wisps and where they work; gold, lumber, and food;
- the Archmage, last seen 40 seconds ago near the north camp. This is a _**contact**_: a record of what was seen, where, and when, not the Archmage himself. Where he is now is an estimate, built from the sighting and from camps found cleared;
- the Town Hall, just seen, and what the bot concludes from it: the enemy is making a fast expansion. The conclusion comes from _**strategy recognition**_, which compares what was seen with a library of known enemy strategies. Each strategy has signs, called _**fingerprints**_: small rules over what was seen and when, such as "an enemy Town Hall built away from its start before 5:00". Seen at 15:00, the same building would be an ordinary expansion. The conclusion is a _**Belief**_ with a confidence, because it may be wrong.

_**Beliefs**_ are one world model in plain data. Small pure functions, the _**belief models**_, revise their parts from the previous _**Beliefs**_ and the new _**observations**_; nothing else writes to _**Beliefs**_. Three rules keep them honest:

- **_Contacts_, not actors.** _**Beliefs**_ never hold enemy units, only what was seen and inferred. A remembered position stops counting once that place is seen empty.
- **Uncertainty stays visible.** Inferred facts carry their confidence and age.
- **Derived facts are filtered once.** A fact such as "the base is threatened" gets its hysteresis where it is inferred, so that everything reading it sees the same stable answer.

_**Knowledge**_ is everything known before the game starts, and it never changes during the game. Game data (costs, build times, damage tables, requirements) and map knowledge (terrain, trees, regions, creep camps, shops) come from build-time tooling and are handed to the _**mind**_ when it is created. Whatever changes during a game, however rarely, is not _**Knowledge**_: trees are cut down and buildings go up, opening and closing routes, so _**Beliefs**_ hold the map as the bot believes it now. Pure _**Knowledge**_ functions compute what all parts must agree on, such as the _**combat estimate**_ and travel time. When the raid asks whether the Demon Hunter can reach the Town Hall before it is finished, it uses the same build time and travel time as every other part of the bot.

Details: [Beliefs and Knowledge](rts-behavior-architecture.md#43-beliefs-and-knowledge), [The enemy model](rts-behavior-architecture.md#412-the-enemy-model).

## 5. Interpreting: Assessments

_**Beliefs**_ say what is true. _**Assessments**_ say what it means for the bot. Five Footmen at the Wisps are a fact; whether they are a serious threat depends on what defends the Wisps. That judgment belongs to the _**threat assessment**_.

Right after the Wisp's sighting, the _**threat assessment**_ finds no threat to any base, and the _**danger assessment**_ rates the route to the north expansion safe enough for the Demon Hunter.

An interpretation becomes an _**assessment**_ when several parts need it and must agree on it: the threat to a base, danger by region, relative army strength, map control. An interpretation only one module needs stays inside that module as a private _**judgment**_, such as a _**Tactic**_'s view of its own fight.

Like _**Beliefs**_, _**Assessments**_ are plain data, updated right after the _**Beliefs**_ they read, every tick or more slowly. Neither of them creates _**Desires**_. They are information, which the _**desire**_ sources read:

```text
observations ─▶ Beliefs ─▶ Assessments
                   │            │
                   └─ read by ──┘
                        ▼
concerns, playbook, requests ─▶ Desires
```

Which strategy the enemy follows is a claim about the world, so recognizing it belongs to _**Beliefs**_, as in the previous section. Whether that strategy beats ours is an _**assessment**_.

Details: [Assessments](rts-behavior-architecture.md#44-assessments).

## 6. Wanting: Desires

A _**Desire**_ is an outcome the bot considers worth pursuing: `DefendBase{main}`, `AcquireItem{Demon Hunter, Staff}`, `RaidBase{north expansion}`. A _**Desire**_ commits to nothing, and _**Desires**_ are cheap: they are recomputed every _**deliberation**_ cycle, about once a second.

_**Desires**_ are made of _**proposals**_. A _**proposal**_ is one source saying "this outcome is worth pursuing", together with how strongly and why. Each cycle, the _**mind**_ asks three sources for their _**proposals**_:

- _**Concerns**_, what any competent player keeps caring about all game: safe bases, living heroes, supply ahead. BDI literature calls them maintenance goals. Each reads _**Beliefs**_ and _**Assessments**_, and proposes a _**Desire**_ when a condition breaks, or is about to.
- **The _playbook_**, what the current game plan wants. In its Harass phase, Fast Bears proposes, in falling _**weight**_, buying the Staff, harassing the enemy hero, and creeping with the Demon Hunter.
- _**Requests**_ from active _**Intentions**_, for what a commitment needs, such as an item or help. A _**request**_ disappears with the _**Intention**_ that made it.

Each _**proposal**_ carries a _**rank**_, a _**weight**_, and a **reason**. The _**rank**_ is a category, from _**Survival**_ down to _**Background**_: a threat the _**threat assessment**_ rates lethal is _**Survival**_, a serious one is _**Emergency**_, the game plan's own goals are _**Game plan**_, and so is a small threat such as a lone Footman at the Wisps; a short-lived gain is usually an _**Opportunity**_, and upkeep that is never urgent is _**Background**_. The _**weight**_ is the value within the _**rank**_, in gold: how far pursuing the outcome would move the balance between the two sides. It is computed from _**Beliefs**_ and _**Assessments**_, with time priced by how fast the balance is moving, and the numbers in this introduction are illustrative; a _**weight**_ of 0 vetoes the _**proposal**_. A higher _**rank**_ always comes first, and _**weight**_ orders _**proposals**_ within a _**rank**_.

_**Proposals**_ for the same outcome merge into one _**Desire**_. The _**Desire**_ ranks as its strongest _**proposal**_, and it lasts only while at least one source still proposes it. _**Deliberation**_ adopts at most one _**Intention**_ per _**Desire**_. For example, if the Staff were out of stock and the harassment ran without it, two sources would propose buying it:

| Source                             | Proposes                           | Rank            | Weight (gold) | Reason                         |
| ---------------------------------- | ---------------------------------- | --------------- | ------------- | ------------------------------ |
| the _**playbook**_'s Harass phase  | `AcquireItem{Demon Hunter, Staff}` | _**Game plan**_ | 280           | the phase wants an escape item |
| the harassment, as a _**request**_ | `AcquireItem{Demon Hunter, Staff}` | _**Game plan**_ | 320           | hit and run needs an escape    |

That is two _**proposals**_, one _**Desire**_ ranked _**Game plan**_ with 320 gold, and at most one _**Intention**_. When the harassment ends, its _**request**_ goes with it, and the _**playbook**_'s _**proposal**_ alone keeps the _**Desire**_ alive. A _**Desire**_ nobody proposes any more disappears, and an _**Intention**_ still pursuing it is dropped.

Right after the sighting, the bot wants this:

| Desire                      | Source                                               | Rank            | Weight (gold) | Reason                                           |
| --------------------------- | ---------------------------------------------------- | --------------- | ------------- | ------------------------------------------------ |
| `RaidBase{north expansion}` | the _**playbook**_'s fast-expansion _**adaptation**_ | _**Game plan**_ | 340           | fast expansion seen; the Town Hall is unfinished |
| `HarassEnemyHero{Archmage}` | the _**playbook**_'s Harass phase                    | _**Game plan**_ | 240           | the Harass phase                                 |
| `Creep{Demon Hunter}`       | the _**playbook**_'s Harass phase                    | _**Game plan**_ | lower         | the Harass phase                                 |

The raid is a short-lived chance, so its _**proposal**_ carries a _**window**_: it is worth something only until the Town Hall is finished. If the Demon Hunter could not get there in time, its _**weight**_ would drop to 0 and the _**Desire**_ would disappear without anyone canceling it.

There is no _**Desire**_ to defend the base yet, because nothing threatens it. One will appear the moment the _**threat assessment**_ says otherwise, since _**concerns**_ are asked every cycle.

A _**proposal**_ is plain data:

```ts
// A proposal (sketch).
const raidProposal = {
  outcome: { kind: 'RaidBase', base: northExpansion },
  rank: RANK.GAME_PLAN,
  weight: 340, // gold
  reason: 'fast expansion seen; Town Hall unfinished',
};
```

Details: [Desires](rts-behavior-architecture.md#45-desires).

## 7. Committing: Deliberation and Intentions

_**Deliberation**_ turns _**Desires**_ into _**Intentions**_: commitments the bot pursues until they are achieved, become impossible, or are no longer wanted. Each cycle it:

1. checks every active _**Intention**_'s conditions: whether it is achieved, impossible, or must pause;
2. adopts an _**Intention**_ for each valid _**Desire**_ that has none;
3. orders the _**agenda**_: by _**rank**_, then by _**weight**_;
4. records the reasons for all of it.

In the example, _**Deliberation**_ adopts the raid. The _**agenda**_ now reads: the raid (_**Game plan**_, 340 gold), the harassment (_**Game plan**_, 240 gold), creeping (_**Game plan**_, lower).

An _**Intention**_ is **relative to the reason it was adopted for**. When its _**Desire**_ disappears, the _**Intention**_ is dropped, unless it is in a step that must not be interrupted, such as a purchase being made. Nobody has to remember to cancel it.

**_Intention kinds_.** Every _**Intention**_ belongs to a kind, which declares:

- **conditions over _Beliefs_**: when the goal is achieved, when it is impossible, and when it must wait for now, its _**pause condition**_;
- _**plans**_, the alternative ways to pursue it, each with a precondition and a preference;
- _**requests**_: _**Desires**_ for its subgoals;
- **a _failure policy_**: how long a failed _**plan**_ is excluded, how many attempts are allowed, and then whether to retry later or fail.

One small generic runtime chooses the _**plan**_ and handles failure, so kinds do not reimplement it. The raid's _**plan**_ might be "hit the workers": travel, kill the builders and Peasants, and leave before defenders arrive. The harassment's _**plan**_ is hit and run: search, engage, disengage, recover.

**State.** An _**Intention**_ is active, paused, or finished, and its progress is idle, _**starved**_, or running, each with a reason. The harassment is about to be _**starved**_: still adopted and still wanted, but without the Demon Hunter. It keeps its state. When it gets him back, its _**plan**_ works out where it stands from _**Beliefs**_ instead of replaying from where it stopped.

Details: [Deliberation](rts-behavior-architecture.md#46-deliberation), [Intentions](rts-behavior-architecture.md#47-intentions).

## 8. Allocating: who gets the Demon Hunter

Both the raid and the harassment need the Demon Hunter. _**Allocation**_ is the only owner of units and money, and it decides.

Each _**Intention**_ declares its _**needs**_: which units (a given hero, unit types, or a class such as army), how many (a count with a minimum and a maximum, or the fighting strength required), which it prefers (closest, healthiest, already held), and how much gold, lumber, and food. Each round, _**Allocation**_ walks the _**agenda**_ in order and serves the _**needs**_. It takes only what a _**need**_ asks for, preferred units first: a defense against one Footman takes the nearest Archer, not a hero from across the map.

A unit moves from one _**Intention**_ to another only by the _**switching rule**_:

- nothing moves out of a step marked _**uninterruptible**_, such as a Town Portal about to take effect;
- otherwise, a challenger with a higher _**rank**_ wins;
- a challenger with the same _**rank**_ wins only by a margin: a _**commitment constant**_ plus the holder's _**interruption cost**_, what interrupting the holder now would waste.

The raid and the harassment have the same _**rank**_, so the margin applies. The harassment is fighting the Archmage and reports that as its _**interruption cost**_: 40 gold for an engagement under way. With a _**commitment constant**_ of 20 gold, the raid needs a _**weight**_ above 240 + 60 = 300 gold. It has 340, so the Demon Hunter moves to the raid, and the _**decision record**_ keeps every term of the comparison.

_**Interruption costs**_ are named losses, such as "an engagement under way" or "a camp half cleared", not bare numbers. That keeps _**Intentions**_ written by different people on one scale.

A few more rules complete the picture:

- **_Needs_ are declared again every round.** An _**Intention**_ that stops needing a unit simply loses it.
- **Every unit has one owner.** Units nobody asked for go to _**default owners**_: workers to RunEconomy, army units and heroes to Reserve.
- **Every _starvation_ has a named cause:** a higher _**Intention**_ that was served, or a holder the _**switching rule**_ protected.

Money works the same way. It is reserved in _**agenda**_ order, against the stock plus a short projection of income. That is how the bot saves: an unmet _**need**_ reports when it will become affordable, and spending lower on the _**agenda**_ waits.

Details: [Allocation](rts-behavior-architecture.md#48-allocation).

## 9. Acting: from commitment to orders

The raid now owns the Demon Hunter. What it wants from him passes down a short chain:

```text
Intention        RaidBase{north expansion}
  Plan           hit the workers: travel → strike → leave
    Tactic       Siege around the unfinished Town Hall: builders first
      Directive  Demon Hunter: Engage(the building Peasant), role Harasser, retreat at 45 % life
        Unit Behavior (Demon Hunter): reflexes, then skills, opportunities, task
          Order  attack the Peasant
```

- _**Plan**_: one way to pursue the _**Intention**_, written as a small state machine. It runs _**Tactics**_ for its groups.
- _**Tactic**_: a reusable controller for a group: Travel, Skirmish, CreepCamp, HitAndRun, Siege, Hold, Recover. It keeps its group's fight-or-flight state between updates, with separate thresholds for engaging and disengaging so that it does not flip back and forth, and it picks targets and positions. Here, the Siege _**Tactic**_ puts builders first.
- _**Directive**_: what is asked of one unit, from a closed vocabulary: a _**task**_, a _**role**_ (how to play it), and _**latitude**_ (how far the unit may deviate: retreat threshold, opportunism, leash). _**Directives**_ are constraints, not micromanagement.
- _**Unit Behavior**_: every own unit has one, chosen by its unit type. Each tick it runs _**reflexes**_ first, which may override the _**Directive**_ to keep the unit alive. Then it tries _**skills**_ (abilities and items, as the _**role**_ suggests), _**opportunities**_ (within the _**latitude**_), and finally the _**task**_. It returns one order and the reason for it.

_**Roles**_, not unit types, decide how a unit plays: the same Demon Hunter burns the Archmage's mana as a Harasser and the casters' mana as Damage. The order goes to the _**order executor**_, which skips it if the unit is already doing exactly that.

**Opportunities at every level.** Whoever sees a chance, such as a dying creep in range or a lone Peasant on the way, takes it if its value beats the detour, the risk, and what it interrupts, within the _**latitude**_ it was given. A _**Unit Behavior**_ takes a last hit, a _**Tactic**_ finishes a wounded camp, a _**plan**_ takes a camp on its route, and anything bigger becomes a _**Desire**_ that competes on the _**agenda**_. A scout's _**Directive**_ allows free opportunism; the Wisp walking to the Tavern allows none.

Details: [Execution](rts-behavior-architecture.md#49-execution), [Opportunities and latitude](rts-behavior-architecture.md#410-opportunities-and-latitude).

## 10. The twist: an attack at home

While the Demon Hunter raids, five Human Footmen reach the Wisps.

1. **_Reflexes_ first.** The Wisps flee on the next tick. Their owner, RunEconomy, does not change: _**reflexes**_ work whoever owns the unit.
2. **A new _Desire_.** _**Beliefs**_ now hold five Footmen at the Wisps. The _**threat assessment**_ weighs them against what defends the Wisps, two Archers and the Ancient of War, and rates the threat to the main base serious. The _**base-safety concern**_ reads that and proposes `DefendBase{main}`, _**rank Emergency**_, and the new threat runs _**Deliberation**_ on the next tick instead of waiting for the cycle.
3. **A defense sized to the threat.** DefendBase needs strength above the threat, arriving within 20 seconds, and _**Allocation**_ fills that _**need**_ nearest first. The two Archers and the Ancient of War at home are not enough against five Footmen, so the _**need**_ also reaches the Demon Hunter, whose Staff lets him arrive in time. _**Emergency**_ outranks _**Game plan**_, so _**Allocation**_ gives him to the defense; across _**ranks**_, no margin is needed.
4. **Acting.** The defense's _**plan**_ has him use the Staff, and the Hold _**Tactic**_ fights by the Moon Wells, focusing the Footmen.
5. **Back to normal.** The Footmen die, the _**threat assessment**_ clears the threat, and the _**base-safety concern**_ stops proposing, so DefendBase is achieved. The Peasants at the expansion have fled, so the raid's target is gone and it fails with that reason. The harassment is re-checked, finds the _**playbook**_ still proposing it and the Archmage alive, and gets the Demon Hunter back. Its _**plan**_ resumes from _**Beliefs**_: from where the Archmage was last seen.

**The size of the threat decides who comes.** Had a lone Footman come, the units at home would have met the _**need**_, and the Demon Hunter would have stayed on the raid. With nobody at home, the _**threat assessment**_ would rate a lone Footman small, so it would be ranked _**Game plan**_, and the Wisp or two it threatens would not outweigh the raid's _**switching margin**_: the Wisps would flee, and the raid would go on. Recalling a hero for a small threat wastes more than it saves.

No _**Intention**_ told another anything. Every switch came from _**Beliefs**_, _**Desires**_, the _**agenda**_, and _**Allocation**_, and each one has a recorded reason.

## 11. One tick, end to end

Every tick, ten times a second, runs the same phases:

| Phase                                                                                          | Runs                                           |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1. _**Perception**_ observes; _**belief models**_ revise _**Beliefs**_, then _**Assessments**_ | every tick                                     |
| 2. _**Concerns**_, the _**playbook**_, and _**requests**_ propose _**Desires**_                | about once a second, or early on urgent events |
| 3. _**Deliberation**_ checks conditions, adopts _**Intentions**_, and orders the _**agenda**_  | with phase 2                                   |
| 4. _**Allocation**_ serves _**needs**_ in _**agenda**_ order                                   | with phase 2, and when units appear or die     |
| 5. _**Intentions**_ step their _**plans**_, and _**Tactics**_ produce _**Directives**_         | each at its own pace                           |
| 6. Each _**Unit Behavior**_ decides its unit's order                                           | every tick, within a budget                    |
| 7. The _**decision record**_ keeps what was decided and why                                    | every tick                                     |

Each phase reads only _**Beliefs**_ and what earlier phases produced. No part relies on another having run first, an ordering that kept producing bugs in Steamhammer. Slow work runs less often: _**Deliberation**_ about once a second, _**Tactics**_ several times a second, and _**reflexes**_ every tick.

Details: [A tick, phase by phase](rts-behavior-architecture.md#42-a-tick-phase-by-phase), [Timing and budgets](rts-behavior-architecture.md#413-timing-and-budgets).

## 12. The game plan: playbooks

The strategy itself is data. The _**strategy concern**_ proposes executing the _**playbook**_ it prefers, given the matchup and the recognized enemy strategy. There is one _**playbook**_ at a time. The _**strategy concern**_ switches _**playbooks**_ when no _**adaptation**_ of the current one answers the enemy well enough, and switching needs a clearly better score and a minimum time on the current one.

The _**concern**_ only wants a _**playbook**_; _**Deliberation**_ commits to it. Its _**Desire**_, `ExecuteStrategy{playbook}`, becomes an _**Intention**_ like any other: the committed strategy. That _**Intention**_ keeps the _**playbook**_'s current phase, and the _**playbook**_'s rules propose the _**Desires**_ that carry the strategy out, such as `TrainHero{Demon Hunter}` or `Attack`. They compete on the _**agenda**_ with every other _**Desire**_, so a threat at home still outranks the game plan. Fast Bears is one _**playbook**_; a Human tower rush would be another.

A _**playbook**_ holds:

- **phases** with entry conditions, each proposing _**Desires**_. Fast Bears has Opening, Harass, Second hero, Reunite, and Bear timing;
- **an _opening book_**: the exact first steps of the game, in order, such as five Wisps, an Altar of Elders, and scouting the enemy start;
- **production goals** as desired totals, so recomputing a _**Desire**_ never builds twice;
- _**adaptations**_: rules on the recognized enemy strategy, other _**Beliefs**_, and _**Assessments**_ that change _**ranks**_ and _**weights**_, or add and withdraw _**Desires**_. They scale with the recognition's confidence. _**Expectations**_ are _**adaptations**_ that guard the _**playbook**_'s own assumptions, such as "no air units before 8:00";
- **hero skill and item builds**, and style knobs such as aggression.

In the example, the harassment exists because of the Harass phase, and the raid because of the fast-expansion _**adaptation**_. Changing how the bot plays Night Elf versus Human means editing its _**playbook**_, not the machinery.

Details: [Strategy, playbooks, and production](rts-behavior-architecture.md#411-strategy-playbooks-and-production).

## 13. Seeing why: the decision record

Each tick produces one record of plain data:

- the _**Assessments**_ that changed, with their inputs;
- the _**Desires**_ and their _**proposals**_, with _**ranks**_, _**weights**_, and reasons;
- the _**Intentions**_ adopted, paused, or finished, and why;
- the _**agenda**_, and _**Allocation**_'s grants and denials with the terms of the _**switching rule**_;
- each _**plan**_'s phase, each _**Tactic**_'s status, and the _**Directives**_;
- each unit's chosen module and its reason, and the orders.

The same record feeds the in-game overlay (status text over units), logs, traces of end-to-end tests, and assertions in behavioral tests. In the example, it answers "why did the Demon Hunter leave the Archmage?" with the raid's 340 gold against the harassment's 240, plus 20 for commitment and 40 for the engagement under way.

Details: [The decision record](rts-behavior-architecture.md#414-the-decision-record).

## 14. Testing

Because the _**mind**_ takes plain data in and gives plain data out, the story above is also a test scenario:

- a small _**Knowledge**_ fixture: a map with a main base, an expansion site, and a creep camp, and the handful of unit types involved;
- the initial state: the Demon Hunter with the Staff, Archers, the Ancient of War, and Wisps;
- a timeline of _**observations**_: a Town Hall seen under construction, then Footmen near the Wisps.

A test creates a fresh _**mind**_ with a seeded random source, steps it through the timeline, and checks the _**decision record**_ at the coarsest level that pins the behavior: the raid takes the Demon Hunter, the defense takes him away, and the harassment gets him back. The same scenario with a lone Footman checks that the defense leaves him on the raid. Each step can also be tested alone: an _**assessment**_ from given _**Beliefs**_, or _**Desires**_ from given _**Assessments**_, without simulating how a threat was detected. Warcraft is never involved. End-to-end tests run the same _**mind**_ in the game, with the real _**Perception**_ and _**order executor**_, on a test map.

Details: [Testability](rts-behavior-architecture.md#5-testability).

## 15. Where a new behavior goes

Put a behavior at the lowest level that has the information and the authority it needs:

| To add                                                                            | Put it in                                          |
| --------------------------------------------------------------------------------- | -------------------------------------------------- |
| Naga casts Mana Shield when focused                                               | a _**skill**_ in Naga's _**Unit Behavior**_        |
| Workers flee from danger                                                          | a _**reflex**_ in the worker's _**Unit Behavior**_ |
| The army kills Priests first                                                      | a _**Tactic**_'s kill order                        |
| Creeping with the Ancient of War as a tank                                        | a _**plan**_ of the Creep _**Intention kind**_     |
| A new kind of operation, such as an escort                                        | a new outcome kind and _**Intention kind**_        |
| Raiding when the enemy expands early                                              | an _**adaptation**_ in the _**playbook**_          |
| Defending a threatened base, as any player would                                  | a _**concern**_                                    |
| What a situation means, needed by several parts, such as a threat to an expansion | an _**Assessment**_                                |
| Recognizing a new enemy strategy, such as a proxy                                 | an entry in the _**strategy library**_             |
| Inferring a new fact, such as the enemy's tech                                    | an inference rule in _**Beliefs**_                 |
| How long a Town Hall takes to build                                               | _**Knowledge**_                                    |

The full list is in [Where a new behavior goes](rts-behavior-architecture.md#7-where-a-new-behavior-goes).

## 16. What is still open

The proposed architecture is research, and parts of it are unproven:

- every fight-or-flight decision depends on a _**combat estimate**_ that still has to be calibrated;
- some facts the scenarios need, such as shop and Tavern stock, may not be readable through natives;
- item and ability orders need verifying in the game, one by one;
- the format of the map data from the build tooling is not defined yet;
- launching Warcraft III into a test map automatically is unverified.

See [Risks and open questions](rts-behavior-architecture.md#10-risks-and-open-questions) and [Where the coverage is thin](rts-scenario-analysis.md#where-the-coverage-is-thin).

## 17. Glossary

- _**Adaptation**_: a _**playbook**_ rule on inferred _**Beliefs**_ that changes _**ranks**_ and _**weights**_, or adds and withdraws _**Desires**_.
- _**Agenda**_: the active _**Intentions**_, ordered by _**rank**_ and then _**weight**_. _**Allocation**_ serves _**needs**_ in this order.
- _**Allocation**_: the only owner of units and money. It serves _**needs**_ in _**agenda**_ order.
- _**Assessment**_: what _**Beliefs**_ mean for the bot, shared by every part that needs it, such as the threat to a base. It is computed after _**Beliefs**_ and, like them, never proposes _**Desires**_.
- _**Beliefs**_: the bot's world model, in plain data: what it holds true, has seen, or infers.
- _**Concern**_: something the bot keeps caring about all game, such as safe bases; BDI literature calls it a maintenance goal. It reads _**Beliefs**_ and _**Assessments**_, and proposes a _**Desire**_ when a condition breaks or is about to.
- _**Contact**_: a _**Belief**_ about an enemy unit or structure: what was seen, where, when, and how it is known.
- _**Decision record**_: one record per tick of what was decided and why.
- _**Default owner**_: the _**Intention**_ that receives units nobody asked for: RunEconomy for workers, Reserve for army units and heroes.
- _**Deliberation**_: checks _**Intentions**_' conditions, adopts _**Intentions**_ for _**Desires**_, and orders the _**agenda**_.
- _**Desire**_: an outcome worth pursuing, backed by one or more _**proposals**_. It commits to nothing, lasts while anyone proposes it, and gets at most one _**Intention**_.
- _**Directive**_: what is asked of one unit: a _**task**_, a _**role**_, _**latitude**_, and optionally where to stand and where to fall back.
- _**Fingerprint**_: a sign of an enemy strategy in the _**strategy library**_: a small rule over what was seen and when, such as an early Town Hall away from the enemy's start.
- _**Intention**_: a commitment to a _**Desire**_, pursued through _**plans**_ until it is achieved, becomes impossible, or is no longer wanted.
- _**Intention kind**_: the declaration behind _**Intentions**_ of one sort: conditions, _**plans**_, _**requests**_, and a _**failure policy**_.
- _**Interruption cost**_: what interrupting an _**Intention**_ now would waste, given by name and valued in gold. It is part of the _**switching margin**_.
- _**Judgment**_: an interpretation only one module needs, such as a _**Tactic**_'s view of its own fight. It stays private in that module.
- _**Knowledge**_: game data and the map as they are when the game starts, prepared offline and supplied when the _**mind**_ is created. It never changes during a game.
- _**Latitude**_: how far a unit may deviate from its _**Directive**_: retreat threshold, opportunism, leash.
- _**Mind**_: all of the bot's reasoning, between _**Perception**_ and the _**order executor**_. There is one per game.
- _**Need**_: what an _**Intention**_ asks _**Allocation**_ for: units, gold, lumber, or food.
- _**Order executor**_: the only code issuing Warcraft orders.
- _**Pause condition**_: when an _**Intention**_ must wait for now, such as Creep while all its heroes are dead. While it holds, the _**Intention**_ is paused, not dropped.
- _**Perception**_: the only code reading Warcraft state for decisions. It filters by visibility.
- _**Plan**_: one way to pursue an _**Intention**_: a small, re-entrant state machine, chosen by its precondition and preference.
- _**Playbook**_: a strategy as data: phases, an _**opening book**_, production goals, _**adaptations**_, and builds.
- _**Proposal**_: one source backing one outcome: how strongly (a _**rank**_ and a _**weight**_) and why (a reason). _**Proposals**_ for the same outcome merge into one _**Desire**_.
- _**Rank**_: a _**proposal**_'s category: _**Survival**_, _**Emergency**_, _**Game plan**_, _**Opportunity**_, or _**Background**_.
- _**Reflex**_: a _**Unit Behavior**_ module that runs first and may override the _**Directive**_ to keep the unit alive.
- _**Request**_: a _**Desire**_ proposed by an active _**Intention**_ for one of its subgoals.
- _**Role**_: how a unit should play its _**task**_, such as Harasser or Tank.
- _**Starved**_: the progress of an _**Intention**_ whose _**needs**_ go unmet. It keeps its state.
- _**Strategy recognition**_: the inference that matches what was seen against a library of known enemy strategies, and gives the likeliest one or two with a confidence.
- _**Switching rule**_: when a unit may move between _**Intentions**_: never out of an _**uninterruptible**_ step, always to a higher _**rank**_, and within a _**rank**_ only by a margin.
- _**Tactic**_: a reusable controller for a group: fight or flight, targets, positions.
- _**Unit Behavior**_: one per own unit. It turns the unit's _**Directive**_ into an order: _**reflexes**_, _**skills**_, _**opportunities**_, _**task**_.
- _**Weight**_: a _**proposal**_'s value within its _**rank**_, in gold: how far pursuing it would move the balance between the two sides. It is computed from _**Beliefs**_ and _**Assessments**_. A _**weight**_ of 0 vetoes the _**proposal**_.
- _**Window**_: how long an opportunity lasts. A _**Desire**_ that can no longer fit its _**window**_ gets _**weight**_ 0.

## 18. Where to read next

- [`rts-behavior-architecture.md`](rts-behavior-architecture.md): the architecture document, with every rule, sketches, more walkthroughs, and the roadmap.
- [`rts-scenario-analysis.md`](rts-scenario-analysis.md): how each deviation of the Night Elf versus Human scenarios fits the architecture.
- [`rts-research-sources.md`](rts-research-sources.md): what each studied bot and paper contributed.
- [`rts-ideas.md`](rts-ideas.md): techniques that could fill parts of the architecture, such as particles for unseen units.
