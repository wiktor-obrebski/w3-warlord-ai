# Desires

The outcomes the bot currently considers desirable, and the Option Generation that keeps them.

- `desires.ts` — the bot's permanent Desires and the canonical identity of its outcomes.
- `option-generation.ts` — the Option Generation: it tracks the supports Intentions express, lets stale ones decay and expire, and consolidates them into Desires.

The outcome types themselves are contracts (`contracts/desires.ts`).

The runtime creates the Option Generation, generates the current Desires at the start of every tick, and passes them to Deliberation. It runs every Intention update through the Option Generation, whose desire expression reaches Intentions as a capability through Deliberation, and it withdraws the supports of Intentions that left the component tree.

Option Generation decides what is worth pursuing, never what the bot commits to; that is Deliberation's decision.
