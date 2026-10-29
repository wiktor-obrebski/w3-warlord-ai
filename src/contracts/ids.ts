export { type UnitId, type DestructableId };

/**
 * Names a unit, the bot's or another player's, for as long as it exists.
 * The mind never holds Warcraft handles; Perception keeps them. Ids are
 * never reused.
 */
type UnitId = number & { readonly __unitId: never };

/** Names a destructable, such as a tree, for as long as it stands. */
type DestructableId = number & { readonly __destructableId: never };
