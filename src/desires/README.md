# Desires

Where the bot's own Desires come from, and how outcomes are told apart.

- `concerns.ts` — the concerns: what the bot cares about all game, each proposing Desires from the Beliefs every deliberation cycle. So far, the strategy concern, which proposes the playbook the bot prefers.
- `desires.ts` — the identity of an outcome, its kind and its arguments, which merges proposals for the same outcome into one Desire.

The outcome types themselves are contracts (`contracts/desires.ts`); proposals and Desires are `@lib/chain-of-command` types.

The concerns are one source of Desires. The other is the Intentions: each Intention's run may propose requests, such as the playbook's Desires, which the committed strategy proposes. The mind collects both every cycle and hands the Desires to Deliberation. A Desire decides what is worth pursuing, never what the bot commits to; that is Deliberation's decision.
