# Contracts

The type-only vocabulary of the Warlord domain, shared by every layer: the ids naming units and destructables, what crosses the boundaries between Warcraft and the mind (observations, orders, the probes, the decision record), the Beliefs, the outcomes the bot can desire and the proposals backing them, the Warlord types of Intention kinds, plans, and runs, the Directives runs give their units, playbooks and their build orders, records describing observed game objects, and similar stable types.

The Beliefs are the bot's one world model, which every part of the mind reads, so their type is a contract; the belief models maintaining them live in `beliefs/`. What a single reflex or plan run remembers is its execution state and stays with it.

Only types belong here, so modules use `import type` for contracts. Behavior built on them, such as how Unit Behaviors carry out each task, lives elsewhere.
