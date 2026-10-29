# Components

The bot's Intentions, Plans, and Controllers: the commitments it pursues and the execution that pursues them.

- `intentions/` — one module per Intention, with its private Plans and Controllers.
- `plans/`, `controllers/` — Plans and Controllers assembled by more than one Intention.

Each module has one public entry point, `*.api.ts`, exporting its assemble function, the Capabilities it needs, and types its owner reads. Everything else in the module is internal.

Deliberation assembles Intentions through their entry points and supplies their Capabilities; Intentions pass on what their children need. The mind updates every component with the Beliefs. Through Capabilities, components queue orders only for the Actors they hold under actor control, note their decisions in the decision record, and, for now, make a few direct Warcraft calls through the probes; Intentions express Desires through desire expression.

Components import only `@lib/**`, `contracts/`, and their own module. They never import `beliefs/`, `desires/`, `deliberation/`, `capabilities/`, or another component module.
