# Intentions

The bot's Intention kinds, one module each: what it pursues for each kind of outcome, and how.

- `execute-strategy/` — the committed strategy: it follows its playbook's phases and proposes each phase's Desires.
- `establish-tower-position/` — the Human tower rush: Guard Towers next to the enemy main, funded by a home economy and kept repaired.
- `operate-towers/` — the Guard Towers' fire, focused by target priority.

A module's `*.kind.ts` declares the kind, as `@lib/chain-of-command` runs it: its pace, its conditions, its plans, and its failure policy. Each plan starts a run, a class implementing `WarlordPlanRun`, which the generic runtime steps at the kind's pace; a run keeps its own execution state and may propose requests. Larger runs are made of parts in the same module, such as the tower rush's establishing steps, home economy, and tower maintenance, which share the run's state.

Each module has one public entry point, `*.api.ts`, exporting the function creating its kind and the Capabilities the kind needs; the rest of the module is internal. The adoption registry in `deliberation/` creates the kinds and supplies their Capabilities. Through them, a run gives Directives only to the Actors it holds under actor control, notes its decisions in the decision record, and, for now, makes a few direct Warcraft calls through the probes.

Intention kinds import only `@lib/**`, `contracts/`, and their own module.
