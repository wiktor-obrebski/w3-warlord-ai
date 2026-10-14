# Contracts

The type-only vocabulary of the Warlord domain, shared by every layer: the shape of Warlord components, what an Actor is and how actor control is requested, the outcomes the bot can desire, records describing observed game objects, and similar stable types.

Contracts describe the domain; they are not the bot's knowledge about it. Belief types, such as `CommonBeliefs`, a component's declaration of the Common Beliefs it needs, or its Scoped Beliefs, stay with the code that maintains or reads them, even when several components need the same fact.

Only types belong here, so modules use `import type` for contracts. Behavior built on them, such as the actor control policy, lives elsewhere, here in `capabilities/actor-control/`.
