export { type Knowledge };

/**
 * The game and the map as they are when the game starts, supplied when the
 * mind is created. A stub so far: static facts still come from Perception.
 */
type Knowledge = Readonly<Record<string, never>>;
