# Beliefs

The bot's shared knowledge about the game: the Common Beliefs model, which turns what a player may legitimately observe into the Common Beliefs, and what feeds it, such as observed attacks and the game clock. It must respect the fair-information boundary: nothing here may reveal what a player could not see.

Perception is not a separate layer yet: the model's `observe()` reads Warcraft state, and `revise()` keeps what must be remembered across ticks, such as recent attacks. Facts about the bot itself that no Warcraft API reports, such as its adopted strategy, are passed in by the runtime and observed like the world.

The runtime revises the Common Beliefs at the start of every tick, through the beliefs runtime of `@lib/bdi`, which owns the belief state. Deliberation reads the `CommonBeliefs` type directly. Components never import this layer: each declares the part of the Common Beliefs it needs (`*.common-beliefs.ts`) and receives the whole Common Beliefs at runtime. Scoped Beliefs belong to the component modules that read them, not here.
