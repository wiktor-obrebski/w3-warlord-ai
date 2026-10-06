/**
 * Decides which Intentions the agent currently pursues, and so owns their
 * lifecycle.
 */
export interface Deliberation<TBeliefs, TDesire, TIntention> {
  /**
   * Returns the Intentions to pursue from now on.
   *
   * An Intention is retained by returning the same instance from
   * `intentions`, so it keeps its execution state; it is dropped by leaving it
   * out; it is created by returning a new instance. Retained Intentions must
   * not be recreated.
   */
  deliberate(
    beliefs: Readonly<TBeliefs>,
    desires: readonly TDesire[],
    intentions: readonly TIntention[],
  ): readonly TIntention[];
}
