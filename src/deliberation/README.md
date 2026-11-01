# Deliberation

The adoption registry (`intention-kinds.ts`): which Intention kind pursues each kind of outcome. Deliberation itself, which adopts, pauses, drops, and orders the Intentions, is `@lib/chain-of-command`'s; it asks the registry for the kind to adopt.

The registry is the only place that creates Intention kinds, through their `*.api.ts` entry points, and supplies their Capabilities, such as the probes, which the mind hands to it, and the playbooks.
