# Capabilities

Implementations of what Intention kinds and Unit Behaviors declare in their Capabilities: functionality several of them rely on that needs one authoritative implementation, often with state of its own, such as actor control, and later navigation or building placement.

Each capability is its own module, `capabilities/<capability>/`. Intention kinds and Unit Behaviors never import this layer; they declare the Capabilities they need, and the mind creates the implementations and hands them over, to the Intention kinds through the adoption registry in `deliberation/`.

A capability that needs Beliefs takes them as an argument rather than reaching for the bot's belief state. It reads nothing from Warcraft: like everything in the mind, it learns about the game only from Perception, through the Beliefs it is given.
