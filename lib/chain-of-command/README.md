# `@lib/chain-of-command`

The decision layer of a Chain of Command agent: proposals merged into Desires, Deliberation over them, a small generic runtime pursuing Intentions through plans, and Allocation granting them units and money. It knows nothing about any game: outcomes, beliefs, units, resources, and what plans do are the caller's types and code.

## Vocabulary

| Concept        | Contract                                                  | Meaning                                                                                                                                            |
| -------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proposal       | `Proposal`, `ProposalSource`, `SourcedProposal`           | One source backing one outcome: an outcome, a rank, a weight, and a reason. Sources propose afresh every deliberation cycle.                       |
| Rank           | `RANK`                                                    | A proposal's category: Survival, Emergency, Game plan, Opportunity, or Background. A higher rank always comes first, whatever the weights.         |
| Weight         | `Proposal.weight`                                         | The value within the rank, on one scale for every proposal. A weight of 0 vetoes the proposal.                                                     |
| Desire         | `Desire`, `collectDesires`                                | An outcome worth pursuing in this cycle, backed by every proposal for it. It ranks as its best proposal.                                           |
| Intention kind | `IntentionKind`                                           | The declaration behind Intentions of one kind of outcome: conditions, plans, a failure policy, and a pace.                                         |
| Plan, run      | `Plan`, `PlanRun`, `PlanStep`                             | One way to pursue an Intention, chosen by applicability and preference; each attempt at it is a run, which may declare needs and propose requests. |
| Need, force    | `Needs`, `UnitNeed`, `Money`, `Force`                     | The units and money a run asks for, and those granted to its Intention, which the run is stepped with.                                             |
| Allocation     | `allocate`, `Grant`, `NeedGrant`                          | The only owner of units and money: serves the needs in agenda order.                                                                               |
| Failure policy | `FailurePolicy`                                           | How long a failed plan is excluded, how many failed runs are allowed, and then whether to recur or to give up.                                     |
| Intention      | `Intention`, `IntentionStatus`, `IntentionEvent`          | A commitment to one Desire: active, paused, or finished.                                                                                           |
| Deliberation   | `Deliberation`, `DeliberationCycle`, `createDeliberation` | Drops, finishes, pauses, and adopts Intentions, and orders the agenda.                                                                             |

## A deliberation cycle

```ts
const deliberation = createDeliberation<Outcome, Beliefs, Unit, Resource>({
  kindOf: ({ outcome }) => kinds[outcome.kind],
});

const desires = collectDesires({
  sources: [
    ...concerns.map((concern) => ({
      name: concern.name,
      proposals: concern.propose({ beliefs }),
    })),
    ...agenda.map((intention) => ({
      name: intention.desireId,
      proposals: intention.requests({ beliefs }),
    })),
  ],
  identify: ({ outcome }) => identityOf({ outcome }),
});
const { agenda, events } = deliberation.deliberate({ desires, beliefs });

const grants = allocate({ agenda, units, stock, beliefs, now });

for (const { intention, force } of grants) {
  record({ events: intention.step({ beliefs, now, force }) });
}
```

The caller decides how often cycles and Allocation rounds run, and steps the agenda's Intentions as often as it likes: each Intention steps only as often as its kind's pace allows.

## Desires

- `collectDesires` merges proposals with the same identity into one Desire, in the order their outcomes are first proposed.
- A Desire's best proposal has the highest rank, then the highest weight; of equally strong proposals, the first one proposed.
- A Desire is valid while its best proposal weighs more than 0.

## Deliberation

Each cycle, `deliberate`:

1. **Reconsiders every unfinished Intention**, in this order:
   - drops it when its Desire is gone or vetoed;
   - finishes it as achieved, or as failed, when its kind's `achieved` or `impossible` condition holds;
   - pauses it while its `paused` condition holds, and resumes it once the condition no longer holds.
2. **Adopts** an Intention of the outcome's kind, as `kindOf` returns it, for every valid Desire without one, unless the outcome is already achieved or impossible.
   - **After giving up, the Desire must lapse.** A Desire whose last Intention gave up gets a new one only once no source has proposed it for a cycle.
3. **Orders the agenda**: the unfinished Intentions, by their Desires' rank, then weight, then adoption order.

It returns the agenda and an event, with its reason, for every adoption, pause, resumption, and end.

## Intentions

`Intention.step` is the means-end reasoning, done once per pace of its kind:

- Without a run, it starts the best applicable plan that is not excluded: the highest preference, then the one listed first.
- It steps the run with the Intention's force. A run that succeeds ends, and the next step chooses a plan again. A run that fails excludes its plan for `excludeSeconds`.
- After `attempts` failed runs, or when no plan applies, the Intention is exhausted. It then recurs, pausing until `excludeSeconds` later, or fails, giving up.
- A paused Intention is not stepped, except one waiting to recur once its time has come. A run is kept while its Intention is paused.

An Intention that finishes while it is stepped leaves the agenda in the next cycle.

## Allocation

Each round, `allocate` walks the agenda in order and asks every Intention for its run's needs:

- **Each unit goes to the first Intention with a need it matches**, for the first such need that has room left: a need takes every unit it matches, or at most its `max`. A unit no need matches stays free.
- **Money is reserved in the same order.** An Intention's money need is met, as far as it can be, from what the Intentions before it left of the stock, and its force holds what was reserved. A need met only in part keeps what it got, so an Intention saving for something keeps that money from the ones after it.
- **Needs are asked anew every round**, so an Intention that no longer needs a unit or money loses it without releasing anything.
- **A paused or finished Intention needs nothing.** An active one without a run first starts its best applicable plan, so a new run is granted its force before its first step; its start is reported by the next `step`.

The agenda's order alone decides who gets what: there are no minimums or switching margins yet, and an Intention keeps no unit it held before unless it is first to ask again. An Intention last on the agenda whose need matches every unit of a class takes whatever the others left, as a default owner would.

## Constraints

The library runs under TypeScriptToLua. Sorting does not depend on a stable sort, and no decision depends on the truthiness of a string or a number.
