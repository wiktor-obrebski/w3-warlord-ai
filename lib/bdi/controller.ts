export { type Controller };

/**
 * Continuous reactive behavior with no procedural completion.
 *
 * A Controller may keep private execution state but treats Beliefs as
 * read-only input. `TBeliefs` is the Beliefs it reads, normally
 * `ComponentBeliefs`; `TControl` is the agent's actor control capability,
 * normally an `ActorControlProvider`.
 */
interface Controller<TBeliefs, TControl> {
  /**
   * Reacts to the current Beliefs. It may order only the Actors `control`
   * grants it.
   */
  update({
    beliefs,
    control,
  }: {
    beliefs: Readonly<TBeliefs>;
    control: TControl;
  }): void;
}
