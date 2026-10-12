export { type Controller };

interface ControllerUpdateArgs<TBeliefs> {
  beliefs: Readonly<TBeliefs>;
}

/**
 * Continuous reactive behavior with no procedural completion.
 *
 * A Controller may keep private execution state but treats Beliefs as
 * read-only input. `TBeliefs` is the Beliefs it reads, normally
 * `ComponentBeliefs`. Whatever else it needs, such as actor control, it
 * receives as capabilities when it is assembled.
 */
interface Controller<TBeliefs> {
  /**
   * Reacts to the current Beliefs. It may order only the Actors its actor
   * control grants it during this update.
   */
  update({ beliefs }: ControllerUpdateArgs<TBeliefs>): void;
}
