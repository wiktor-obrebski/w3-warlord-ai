# Deliberation

Decides which commitments the bot pursues and so owns the Intention lifecycle: it adopts Intentions for the current Desires, asks each retained Intention to assess whether its commitment remains worthwhile, and drops those that should end. It also reports the strategy it has committed to. The policy is fixed for now.

The runtime calls it once per tick with the Common Beliefs, the current Desires, and the active Intentions, and makes the Intentions it returns the managed component tree. Deliberation is the only place that assembles Intentions, through their `*.api.ts` entry points, and supplies their Capabilities, such as actor control and desire expression, which the runtime hands to it.

It neither orders Actors nor expresses Desires itself, and leaves domain-specific judgments, such as how close an Intention is to completing, to the Intentions' own commitment assessments.
