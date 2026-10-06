# `@lib/bdi`

Minimal, domain-independent contracts for a Belief–Desire–Intention (BDI) agent.

The library contains interfaces only. It knows nothing about Warcraft III or any particular strategy; domain code implements these contracts and depends on this library, never the other way round:

```text
@lib/bdi
    ↑
domain code
```

## Vocabulary

| Concept | Contract | Meaning |
| --- | --- | --- |
| Beliefs | `BeliefModel` | What the agent currently believes about the world, produced by observing and revising. |
| Desires | `Desire` | High-level states or principles the agent wants to achieve or maintain. No behavior. |
| Deliberation | `Deliberation` | Decides which Intentions exist; owns their lifecycle. |
| Intentions | `Intention` | Concrete commitments currently being pursued. Active while Deliberation retains them. |
| Plans | `Plan`, `PlanStatus` | Finite procedural execution with an explicit `running` / `succeeded` / `failed` status. |
| Controllers | `Controller` | Continuous reactive behavior without procedural completion. |

## Cycle

Each agent cycle is expected to run:

```text
1. observation = model.observe()
2. beliefs     = model.revise(previousBeliefs, observation)
3. desires     = the Desires currently held
4. intentions  = deliberation.deliberate(beliefs, desires, intentions)
5. intention.update(beliefs) for every active Intention
     → its Plans and Controllers
```

The Beliefs produced in step 2 are a snapshot: nothing changes them for the rest of the cycle. Every later step receives them as read-only input.

## Contracts

### `BeliefModel<TObservation, TBeliefs>`

```ts
observe(): TObservation
revise(previous: Readonly<TBeliefs> | undefined, observation: Readonly<TObservation>): TBeliefs
```

`revise()` combines the previous Beliefs with the current Observation. It must not mutate either input, and may return `previous` unchanged when nothing changed. `previous` is `undefined` on the first cycle.

Belief and Observation types should prefer `readonly` properties and arrays.

### `Desire`

```ts
readonly id: string
readonly description: string
```

### `Deliberation<TBeliefs, TDesire, TIntention>`

```ts
deliberate(beliefs, desires, intentions): readonly TIntention[]
```

The returned set defines which commitments remain active:

- returning an instance from `intentions` retains it, together with its execution state;
- leaving an instance out drops it;
- returning a new instance creates an Intention.

Retained Intentions must not be recreated. One Desire may lead to any number of Intentions, including none.

### `Intention<TBeliefs>`

```ts
update(beliefs): void
```

An Intention has no success or failure status of its own; it is active exactly while Deliberation retains it. It may own Plans, Controllers, and internal execution state, and decides when to update them.

### `Plan<TBeliefs>`

```ts
readonly status: PlanStatus  // "running" | "succeeded" | "failed"
update(beliefs): void
```

`status` is persistent state changed only during `update()`. Reading it is an inspection, not a re-evaluation. A Plan's success or failure does not by itself end the Intention that owns it.

### `Controller<TBeliefs>`

```ts
update(beliefs): void
```

A Controller reacts continuously and never completes. It may keep private execution state.

## Deliberately omitted

Intention scheduling, resource arbitration, unit assignment, and command arbitration are not part of this library yet. Add contracts only when the agent has a concrete use for them.
