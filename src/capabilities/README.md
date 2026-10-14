# Capabilities

Implementations of what components declare in their Capabilities: functionality several components rely on that needs one authoritative implementation, often with state of its own, such as actor control, and later navigation or building placement.

Each capability is its own module, `capabilities/<capability>/`. Components never import this layer; they declare the Capabilities they need, and the runtime creates the implementations and hands them, through Deliberation, to the components.

Desire expression reaches Intentions the same way but is not implemented here: it is part of the bot's Option Generation, created in `desires/`.

A capability that needs Beliefs takes them as an argument, typed by its own declaration of what it needs, rather than reaching for the bot's belief state. It may read static map data from Warcraft, which a player sees too; anything dynamic about units comes from the Beliefs it is given.
