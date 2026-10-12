# `@lib/bdi`

Minimal, domain-independent contracts for a Belief–Desire–Intention (BDI) agent, the beliefs runtime that keeps its Beliefs revised, and the arbiter that decides which Plan or Controller may order each Actor.

The library knows nothing about Warcraft III or any particular strategy; domain code implements these contracts and depends on this library, never the other way round:

```text
@lib/bdi
    ↑
domain code
```

## Vocabulary

| Concept       | Contract                                                                  | Meaning                                                                                                      |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Beliefs       | `CommonBeliefsModel`, `BeliefsModel`, `BeliefContainer`, `BeliefsRuntime` | What the agent knows about the world, including what it remembers across cycles.                             |
| Desires       | `Desire`                                                                  | High-level states or principles the agent wants to achieve or maintain. No behavior.                         |
| Deliberation  | `Deliberation`                                                            | Decides which Intentions exist; owns their lifecycle.                                                        |
| Intentions    | `Intention`                                                               | Concrete commitments currently being pursued. Active while Deliberation retains them.                        |
| Plans         | `Plan`, `PlanStatus`                                                      | Finite procedural execution with an explicit `running` / `succeeded` / `failed` status.                      |
| Controllers   | `Controller`                                                              | Continuous reactive behavior without procedural completion.                                                  |
| Assembly      | `AssembledComponent`, `childFactory`                                      | How Intentions, Plans, and Controllers are constructed, together with what the runtime needs to manage them. |
| Actor Control | `ActorControlProvider`, `ActorControlArbiter`, `ActorControlPolicy`       | Temporary exclusive right of a Plan or Controller to order an Actor.                                         |

Beliefs are knowledge about the world ("worker 17 was attacked 0.8 s ago"). Execution state ("the current flee destination", "the current Plan step") stays private to the Intention, Plan, or Controller that owns it.

## Beliefs

There are two categories of Beliefs:

```text
Common Beliefs    shared by the whole agent, read by every component
Scoped Beliefs    private belief state of one Intention, Plan, or Controller instance
```

### Ownership

```text
CommonBeliefsModel   defines how the Common Beliefs are observed and revised
BeliefsModel         defines how one kind of Scoped Beliefs is observed and revised
BeliefContainer      stores the Common Beliefs and the Scoped Beliefs of each component instance
BeliefsRuntime       registers components, revises their Beliefs, removes them when components go
components           read the Common Beliefs and their own Scoped Beliefs
```

Belief state is owned by the runtime, never by components. A component never sees its `BeliefsModel` and never calls `observe()` or `revise()`.

### Instance scope

Scoped Beliefs are indexed by the component instance. A `BeliefsModel` is behavior without state, so one model may serve any number of components; each instance still has its own belief history:

```text
WorkerSafetyController #A ─┐                       ┌─ Beliefs A
                           ├─ workerSafetyModel ─→ │
WorkerSafetyController #B ─┘                       └─ Beliefs B
```

Configuration, such as which mine a Plan targets, is given to the component by its assemble function and is not Belief state; the Beliefs describe what is currently known about that target.

### Stored versus derived

Store what must persist across cycles or is expensive to derive, such as when something was last seen or attacked. Derive transient views from existing Beliefs with pure functions (the agent may call them Assessments) instead of storing synchronized copies. Prefer referring to entities kept in the Common Beliefs over copying their state into Scoped Beliefs.

### Revision and allocation

`revise()` treats its inputs as immutable and returns the Beliefs that become current. `previous` is `null` on the first revision, which creates the initial Beliefs. It should return `previous` itself when nothing changed and reuse unchanged nested values, so that unchanged Beliefs cost no allocation. It must never mutate `previous` to save one.

## Assembly and the component tree

Every Intention, Plan, and Controller is constructed by an assemble function, which returns an `AssembledComponent`:

```ts
{
  component,      // the component itself
  beliefsModel?,  // maintains its Scoped Beliefs; omitted when it has none
  children,       // the assembled components of its children
}
```

The component class stays private to its module, so the runtime always receives a component together with its metadata, and the component never sees it.

A component that creates children at run time receives child factories from its assemble function. `childFactory({ children, assemble })` returns a function that calls the child's assemble function, records the result in the parent's `children`, and returns only a handle:

```ts
const plan = this.createPlan(); // { component, discard }
updateChild({ child: plan.component });
plan.discard(); // the child leaves the tree
```

The assembled components form the component tree the beliefs runtime manages; the same mechanism applies at every level.

## Cycle

```text
1. commonBeliefs = beliefs.reviseCommon()
2. { intentions } = deliberation.deliberate({ beliefs: commonBeliefs, desires, intentions })   // assembled components
3. beliefs.sync({ roots: intentions })
     register new components, remove gone ones, revise every Scoped Beliefs
4. intention.component.update({ beliefs: beliefs.beliefsOf({ component: intention.component }), updateChild }) for every Intention
     → updateChild({ child }): arbiter.update({ source: child, run: () => child.update({ beliefs: beliefs.beliefsOf({ component: child }) }) })
5. arbiter.releaseInactive({ activeSources: beliefs.prune() })
```

A component created during step 4 is registered, and its Scoped Beliefs first revised, by `beliefsOf()` before its first update. A component discarded during step 4 is removed by `prune()`, which also releases its actor control. Revising a new component adds Beliefs but changes no other component's.

## Contracts

### `CommonBeliefsModel<TCommonBeliefs, TObservation = unknown>`

```ts
observe(): TObservation
revise({ previous, observation }: {
  previous: Readonly<TCommonBeliefs> | null;
  observation: Readonly<TObservation>;
}): TCommonBeliefs
```

### `BeliefsModel<TBeliefs, TCommonBeliefs = unknown, TObservation = unknown>`

```ts
observe(): TObservation
revise({ previous, observation, commonBeliefs }: {
  previous: Readonly<TBeliefs> | null;
  observation: Readonly<TObservation>;
  commonBeliefs: Readonly<TCommonBeliefs>;
}): TBeliefs   // never null
```

`observe()` takes no parameters and reads the external environment only. The runtime handles every model as `BeliefsModel<unknown, TCommonBeliefs>`.

### `BeliefContainer<TCommonBeliefs>`

```ts
createBeliefContainer({ commonModel }): BeliefContainer<TCommonBeliefs>   // with the first Common Beliefs revision
getCommonBeliefs(): Readonly<TCommonBeliefs>
reviseCommonBeliefs(): { beliefs: Readonly<TCommonBeliefs> }
registerScopedBeliefs({ component, beliefsModel })                       // with the first Scoped Beliefs revision
getScopedBeliefs({ component }): { beliefs: unknown }                    // null beliefs for an unregistered component
reviseScopedBeliefs({ component }): { beliefs: unknown }
removeScopedBeliefs({ component })
```

Stores each Beliefs together with the model that revises them; models go in but never come out. Common and Scoped Beliefs differ only in where they are kept and in that Scoped revisions also read the Common Beliefs. Owned by the beliefs runtime, which decides when Beliefs are revised.

### `BeliefsRuntime<TCommonBeliefs>`

```ts
createBeliefsRuntime({ commonModel }): BeliefsRuntime<TCommonBeliefs>
reviseCommon(): { commonBeliefs: Readonly<TCommonBeliefs> }
sync({ roots }: { roots: readonly AssembledComponent[] }): void
beliefsOf({ component }): ComponentBeliefs<TCommonBeliefs, unknown>   // throws for an unmanaged component
prune(): { managedComponents: ReadonlySet<object> }
```

Removing a component removes its Scoped Beliefs and model association; a shared model is unaffected.

### `ComponentBeliefs<TCommonBeliefs, TScopedBeliefs>`

```ts
readonly commonBeliefs: Readonly<TCommonBeliefs>
readonly scopedBeliefs: TScopedBeliefs   // null for a component without a BeliefsModel
```

The Beliefs a component receives in `update()`. It cannot read any other component's Scoped Beliefs.

### `AssembledComponent<TComponent, TCommonBeliefs, TScopedBeliefs = unknown>`, `childFactory`

```ts
readonly component: TComponent
readonly beliefsModel?: BeliefsModel<TScopedBeliefs, TCommonBeliefs>
readonly children: readonly AssembledComponent<object, TCommonBeliefs>[]

childFactory({ children, assemble }): ChildFactory<TComponent>   // () => ChildHandle<TComponent>
ChildHandle<TComponent>: { component, discard() }
```

An assemble function names the Scoped Beliefs type its component reads as `TScopedBeliefs`, so the compiler checks that the model produces it. The runtime handles every component alike, so it receives the default `unknown`.

`discard()` removes the child's record; discarding twice throws.

### `Desire`

```ts
readonly id: string
readonly description: string
```

### `Deliberation<TBeliefs, TDesire, TIntention>`

```ts
deliberate({ beliefs, desires, intentions }): { intentions: readonly TIntention[] }
```

The returned set defines which commitments remain active:

- returning an instance from `intentions` retains it, together with its execution state;
- leaving an instance out drops it;
- returning a new instance creates an Intention.

Retained Intentions must not be recreated. One Desire may lead to any number of Intentions, including none. An agent may use assembled components as `TIntention`, so the runtime receives each Intention's metadata.

### `Intention<TBeliefs, TChildBeliefs = TBeliefs>`

```ts
update({ beliefs, updateChild }: {
  beliefs: Readonly<TBeliefs>;
  updateChild: UpdateChild<TChildBeliefs>;
}): void
```

An Intention has no success or failure status of its own; it is active exactly while Deliberation retains it. It may own Plans, Controllers, and internal execution state, and decides when to create, update, and discard them. It updates a child only through `updateChild({ child })`, which runs the child's `update()` with the child's own Beliefs and its actor control acting for it.

### `Plan<TBeliefs>`

```ts
readonly status: PlanStatus  // "running" | "succeeded" | "failed"
update({ beliefs }: { beliefs: Readonly<TBeliefs> }): void
```

`TBeliefs` is normally `ComponentBeliefs`.

`status` is persistent state changed only during `update()`. Reading it is an inspection, not a re-evaluation. A Plan's success or failure does not by itself end the Intention that owns it.

### `Controller<TBeliefs>`

```ts
update({ beliefs }: { beliefs: Readonly<TBeliefs> }): void
```

A Controller reacts continuously and never completes. It may keep private execution state.

### Capabilities

`update()` receives only the Beliefs, which the runtime prepares for every update. Anything else a component needs from outside, such as actor control, it receives once, when it is assembled: its assemble function takes the capabilities the component declares, and the component keeps them.

## Actor Control

An **Actor** is anything in the environment the agent can give orders to; its type is the `TActor` parameter. **Actor Control** is the temporary exclusive right of one Plan or Controller — the _source_ — to order an Actor. Every Actor has at most one controlling source.

### `ActorControlProvider<TActor, TRequest>`

```ts
request({ actor, request }: { actor: TActor; request: TRequest }): boolean
```

Given to Plans and Controllers as a capability. One provider serves every source: it always acts for the source whose update is running, so requests need not name the source, and a request outside a source update throws. A source orders an Actor only after a request for it returned `true`:

```ts
if (actorControl.request({ actor: worker, request: 'normal' })) {
  repair({ worker, tower });
}
```

`TRequest` describes how the source asks, such as whether it may preempt; the library gives it no meaning.

### `ActorControlPolicy<TRequest>`

```ts
({
  request,
  currentClaim,
}: {
  request: TRequest;
  currentClaim: ActorControlClaim<TRequest> | null;
}) => boolean;
```

The agent's rule for whether a request takes an Actor the requester does not already control. `currentClaim` is the claim another source holds, with the request that granted or last renewed it, or `null` for an uncontrolled Actor. The library only enforces the mechanism around it: one controller per Actor, renewal of one's own claim (always granted, never sent to the policy; the claim keeps the latest request), and leases.

### Leases

Control is a lease. During each of its updates, a source requests every Actor it still needs; claims it did not request again expire when the update ends. Control therefore follows what the source is currently doing, and a source releases an Actor simply by no longer requesting it. Between updates claims persist, so a source updated less often than every cycle keeps its Actors meanwhile.

### `ActorControlArbiter<TActor, TRequest>`

```ts
createActorControlArbiter<TActor, TRequest>({ policy }): ActorControlArbiter<TActor, TRequest>
readonly actorControl: ActorControlProvider<TActor, TRequest>
update({ source, run }: { source: object; run: () => void }): void
releaseInactive({ activeSources }: { activeSources: ReadonlySet<object> }): void
```

Owned by the agent's runtime and created with the agent's policy. `actorControl` is the provider the agent hands to its components. `update` runs one source update, during which `actorControl` acts for that source, then expires the source's unrenewed claims. `releaseInactive` drops the claims of sources no longer in the managed component tree, such as a discarded Plan, which will not update again to let them expire.

## Deliberately omitted

Intention scheduling, resource arbitration, unit assignment, and command arbitration are not part of this library yet. Add contracts only when the agent has a concrete use for them.
