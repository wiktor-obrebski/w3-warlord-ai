# Beliefs

The bot's shared knowledge about the game: the Common Beliefs model, which turns what Perception reports into the Common Beliefs. It must respect the fair-information boundary: nothing here may reveal what a player could not see.

Perception, in `shell/`, reads Warcraft state. The model's `observe()` returns the observations of the step being run, and `revise()` keeps what must be remembered across steps, such as recent attacks. Facts about the bot itself that no Warcraft API reports, such as its adopted strategy, are passed in by the mind and observed like the world.

The mind revises the Common Beliefs at the start of every step, through the beliefs runtime of `@lib/bdi`, which owns the belief state. Deliberation reads the `CommonBeliefs` type directly. Components never import this layer: each declares the part of the Common Beliefs it needs (`*.common-beliefs.ts`) and receives the whole Common Beliefs at runtime. Scoped Beliefs belong to the component modules that read them, not here.
