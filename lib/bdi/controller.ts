export { type Controller };

interface ControllerUpdateArgs<TBeliefs, TActorControl> {
  beliefs: Readonly<TBeliefs>;
  actorControl: TActorControl;
}

/**
 * Continuous reactive behavior with no procedural completion.
 *
 * A Controller may keep private execution state but treats Beliefs as
 * read-only input. `TBeliefs` is the Beliefs it reads, normally
 * `ComponentBeliefs`; `TActorControl` is the agent's actor control capability,
 * normally an `ActorControlProvider`.
 */
interface Controller<TBeliefs, TActorControl> {
  /**
   * Reacts to the current Beliefs. It may order only the Actors
   * `actorControl` grants it.
   */
  update({
    beliefs,
    actorControl,
  }: ControllerUpdateArgs<TBeliefs, TActorControl>): void;
}
