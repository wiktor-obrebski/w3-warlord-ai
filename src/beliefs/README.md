# Beliefs

The belief models: pure functions revising the Beliefs, the bot's one world model, from what Perception reports. They must respect the fair-information boundary: nothing here may reveal what a player could not see.

Perception, in `shell/`, reads Warcraft state. Each section of the Beliefs (`contracts/beliefs.ts`) is revised from the previous section and the observations of the step being run, keeping what must be remembered across steps, such as recent attacks, and inferring what the observations imply, such as where the enemy started.

The mind revises the Beliefs at the start of every step and passes them to the concerns, Deliberation, the Intentions, and the Unit Behaviors; to everything but the belief models, they are read-only.
