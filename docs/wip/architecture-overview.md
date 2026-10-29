# Architecture Overview

**Chain of Command** is a BDI architecture for real-time strategy: how the WC3 Warlord AI knows, wants, commits, and acts. One _**mind**_ commands many units through a chain of command: commitments go down as constraints, and status comes back up.

This is the short version of the [architecture](architecture.md), which has every rule and the reasons for it; where the two disagree, the architecture is right. Terms of the architecture are set in _**bold italics**_.

## The shape

```text
Warcraft ──▶ Perception ──▶ mind ──▶ order executor ──▶ Warcraft
                             │
                             └──▶ decision record
```

Everything between the two boundaries is plain TypeScript over plain data, so it can be tested without the game and explained after it. The _**mind**_ answers five questions, each in one place:

| Question                                              | Answered by                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| **Know**: what is true, and what does it mean for us? | _**Beliefs**_, _**Assessments**_, _**Knowledge**_                         |
| **Want**: what is worth achieving now?                | _**Desires**_                                                             |
| **Commit**: what do we pursue, and in which order?    | _**Deliberation**_, adopting _**Intentions**_ onto the _**agenda**_       |
| **Allocate**: who gets which units and money?         | _**Allocation**_                                                          |
| **Act**: how does a commitment become orders?         | _**plan**_ → _**Tactic**_ → _**Directive**_ → _**Unit Behavior**_ → order |

## The parts

| Part                  | Does                                                                                       | Never                                                      |
| --------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| _**Perception**_      | turns what the bot can see into _**observations**_                                         | decides anything, or passes on what a player could not see |
| _**Order executor**_  | issues the _**mind**_'s orders to Warcraft                                                 | decides anything                                           |
| _**Beliefs**_         | hold what is true or probably true, with confidence                                        | judge what it means for the bot                            |
| _**Knowledge**_       | holds the game and the map as they are at the start, with pure functions beside it         | changes during a game                                      |
| _**Assessments**_     | say what _**Beliefs**_ mean for the bot, for every part that needs it                      | propose _**Desires**_                                      |
| _**Desires**_         | name outcomes worth pursuing, each with a _**rank**_, a _**weight**_ in gold, and a reason | commit to anything                                         |
| _**Deliberation**_    | adopts _**Intentions**_ for valid _**Desires**_ and orders the _**agenda**_                | hands out units or money                                   |
| _**Intentions**_      | pursue one _**Desire**_ each through a _**plan**_, while the _**Desire**_ lasts            | call each other                                            |
| _**Allocation**_      | owns every unit and all money, serving _**needs**_ in _**agenda**_ order                   | chooses what to pursue                                     |
| _**Plans**_           | carry out one way to pursue an _**Intention**_, running _**Tactics**_ for its groups       | issue orders                                               |
| _**Tactics**_         | steer a group: fight or flight, targets, positions                                         | issue orders                                               |
| _**Directives**_      | ask one unit for a _**task**_, with a _**role**_ and _**latitude**_                        | say how to do it                                           |
| _**Unit Behaviors**_  | turn a unit's _**Directive**_ into one order each tick, _**reflexes**_ first               | deviate beyond their _**latitude**_, except to survive     |
| _**Decision record**_ | holds every decision and why, returned with the orders                                     | leaves a decision without its reason                       |

_**Desires**_ come from three sources: _**concerns**_, what any competent player keeps caring about; the _**playbook**_, the committed strategy as data; and _**requests**_, goals that active _**Intentions**_ depend on but do not pursue themselves.

## One tick

Every 0.1 s, the same phases run:

| Phase                                                                                          | Pace                                             |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1. _**Perception**_ observes; _**belief models**_ revise _**Beliefs**_, then _**Assessments**_ | every tick                                       |
| 2. _**Concerns**_, the _**playbook**_, and _**requests**_ propose _**Desires**_                | about once a second, or at once on urgent events |
| 3. _**Deliberation**_ checks conditions, adopts _**Intentions**_, and orders the _**agenda**_  | with phase 2                                     |
| 4. _**Allocation**_ serves _**needs**_ in _**agenda**_ order                                   | with phase 2, and when units appear or die       |
| 5. _**Plans**_ and _**Tactics**_ step and write _**Directives**_                               | each at its own pace                             |
| 6. Each _**Unit Behavior**_ picks its unit's order                                             | every tick                                       |
| 7. The _**decision record**_ keeps what was decided and why                                    | every tick                                       |

## Rules that hold everywhere

- **Fair information.** Only _**Perception**_ reads Warcraft, and only what a player could see. Only the _**order executor**_ writes to it.
- **A pure _mind_.** Inside the _**mind**_ there are no Warcraft handles, no clock, no unseeded randomness, and no module-level state.
- **One owner per unit.** _**Allocation**_ owns every unit and coin. _**Intentions**_ never take units themselves, and never call each other.
- **Wanting is recomputed.** _**Desires**_ are proposed afresh every cycle, and an _**Intention**_ lasts only while its _**Desire**_ does.
- **_Ranks_ sort, gold weighs.** A _**rank**_ is a category; a _**weight**_ is value in gold. Within a _**rank**_, taking a unit from its holder needs a _**switching margin**_.
- **Constraints down, status up.** A _**Directive**_ says what, not how, and a unit deviates only within its _**latitude**_, or to survive.
- **The map changes; _Knowledge_ does not.** Anything that can change during a game is a _**Belief**_ or an _**Assessment**_.
- **Every decision has a reason**, returned in the _**decision record**_.

## Where a new behavior goes

| To add                                              | Put it in                                                |
| --------------------------------------------------- | -------------------------------------------------------- |
| How a unit survives or uses an ability              | its _**Unit Behavior**_: a _**reflex**_ or a _**skill**_ |
| How a group fights                                  | a _**Tactic**_                                           |
| Another way to pursue a goal                        | a _**plan**_ of its _**Intention kind**_                 |
| A new kind of goal                                  | a new outcome kind and _**Intention kind**_              |
| What any competent player wants                     | a _**concern**_                                          |
| What this strategy wants, or an answer to the enemy | the _**playbook**_                                       |
| What a situation means, for several parts           | an _**Assessment**_                                      |
| A new fact or inference                             | a _**belief model**_                                     |
| How the game works                                  | _**Knowledge**_                                          |

## Read next

- [Introduction](../research/rts-architecture-introduction.md): the architecture built up one idea at a time, around one moment of one game.
- [Architecture](architecture.md): every rule, and why.
- [Testability](architecture-testability.md): what makes the architecture easy to test.
- [Research architecture document](../research/rts-behavior-architecture.md): walkthroughs, the roadmap, and risks.
- [Ideas](../research/rts-ideas.md): techniques the architecture could use but does not depend on.
