/**
 * Continuous reactive behavior with no procedural completion.
 *
 * A Controller may keep private execution state but treats Beliefs as
 * read-only input.
 */
export interface Controller<TBeliefs> {
  /**
   * Reacts to the current Beliefs.
   */
  update(beliefs: Readonly<TBeliefs>): void;
}
