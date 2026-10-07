# `@lib/bdi`

Minimal, domain-independent contracts for a Belief–Desire–Intention (BDI) agent, and the belief runtime that keeps its Beliefs revised.

The library knows nothing about Warcraft III or any particular strategy; domain code implements these contracts and depends on this library, never the other way round:

```text
@lib/bdi
    ↑
domain code
```

## Vocabulary

| Concept | Contract | Meaning |
| --- | --- | --- |
| Beliefs | `BeliefModel`, `BeliefContainer` | What the agent knows about the world, including what it remembers across cycles. |
| Desires | `Desire` | High-level states or principles the agent wants to achieve or maintain. No behavior. |
| Deliberation | `Deliberation` | Decides which Intentions exist; owns their lifecycle. |
| Intentions | `Intention` | Concrete commitments currently being pursued. Active while Deliberation retains them. |
| Plans | `Plan`, `PlanStatus` | Finite procedural execution with an explicit `running` / `succeeded` / `failed` status. |
| Controllers | `Controller` | Continuous reactive behavior without procedural completion. |

Beliefs are knowledge about the world ("worker 17 was attacked 0.8 s ago"). Execution state ("the current flee destination", "the current Plan step") stays private to the Intention, Plan, or Controller that owns it.

## Beliefs

Beliefs are not one global object. Each kind of knowledge has its own `BeliefModel` and its own Beliefs type, defined by the feature that needs it. The agent keeps a few core models, such as one for common game knowledge; Intentions, Plans, and Controllers declare the specialized models they need.

### Ownership

```text
BeliefModel          defines how one kind of Beliefs is observed and revised
belief runtime       finds the required models, orders them, and revises them
BeliefContainer      holds the current Beliefs of every active model instance
execution components declare the models they need and read their Beliefs
```

Belief state is owned by the runtime, never by execution components. Components do not call `observe()` or `revise()`.

### Instance scope

Belief state belongs to a **model instance**, not a model type. A component that needs Beliefs of its own creates its own model instances, configured with what it is responsible for:

```text
BuildTowersAroundMine #A  → new MineSurroundingsModel(mineA) → Beliefs A
BuildTowersAroundMine #B  → new MineSurroundingsModel(mineB) → Beliefs B
```

Configuration, such as which mine a Plan targets, identifies the instance and is not Belief state; the Beliefs describe what is currently known about that target.

### Dependencies

A model may depend on the Beliefs of other model instances, declared in its `dependencies`. The runtime revises dependencies first and passes their current Beliefs to `revise()`; a model never invokes another model. Dependencies must be acyclic; a cycle throws.

### Stored versus derived

Store what must persist across cycles or is expensive to derive, such as when something was last seen or attacked. Derive transient views from existing Beliefs with selector functions instead of storing synchronized copies. Prefer referring to entities kept by a common model over copying their state into scoped Beliefs.

### Revision and allocation

`revise()` treats its inputs as immutable and returns the Beliefs that become current. It should return `previous` itself when nothing changed and reuse unchanged nested values, so that unchanged Beliefs cost no allocation. It must never mutate `previous` to save one.

## Cycle

```text
1. core = reviseBeliefs(coreModels, previousContainer)
2. desires     = the Desires currently held
3. intentions  = deliberation.deliberate(core, desires, intentions)
4. container   = reviseBeliefs(requiredBeliefModels(intentions), previousContainer, core)
5. intention.update(container) for every active Intention
     → its Plans and Controllers
```

Core Beliefs are revised before Deliberation; the scoped Beliefs required by the resulting execution graph after it. A model newly required is revised from `previous = undefined`, so its Beliefs are available in the cycle it becomes active. Beliefs of models no longer required are dropped.

The container produced in step 4 is the snapshot for the rest of the cycle: nothing changes it until the next cycle.

## Contracts

### `BeliefModel<TObservation, TBeliefs, TDependencies = undefined>`

```ts
readonly dependencies: BeliefDependencies<TDependencies>  // undefined without dependencies
observe(): TObservation
revise(previous: Readonly<TBeliefs> | undefined,
       observation: Readonly<TObservation>,
       dependencies: Readonly<TDependencies>): TBeliefs
```

`observe()` reads the external environment only. `AnyBeliefModel<TBeliefs>` is any model producing `TBeliefs`, used where its observation and dependencies do not matter.

### `BeliefContainer`

```ts
get(model): Readonly<TBeliefs>   // throws when the model is not active
has(model): boolean
```

Immutable; created by the belief runtime.

### Belief runtime

```ts
requiredBeliefModels(components): AnyBeliefModel[]
reviseBeliefs(models, previous, revised?): BeliefContainer
```

`requiredBeliefModels` walks the components and their active children and collects the declared models. `reviseBeliefs` revises the models and their dependencies, dependencies first, into a new container; models already in `revised` are carried over unrevised.

### `ExecutionComponent`

```ts
readonly beliefModels?: readonly AnyBeliefModel[]
activeChildren?(): readonly ExecutionComponent[]
```

Base of `Intention`, `Plan`, and `Controller`. A component declares the models it reads beyond the core ones, and which children are currently active, decided from its own execution state and current Beliefs. A child whose Beliefs would only tell whether it has work should stay active and do nothing.

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
