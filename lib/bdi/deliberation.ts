export { type Deliberation };

interface DeliberationDeliberateArgs<TBeliefs, TDesire, TIntention> {
  beliefs: Readonly<TBeliefs>;
  desires: readonly TDesire[];
  intentions: readonly TIntention[];
}

/**
 * Decides which Intentions the agent currently pursues, and so owns their
 * lifecycle.
 */
interface Deliberation<TBeliefs, TDesire, TIntention> {
  /**
   * Returns the Intentions to pursue from now on.
   *
   * An Intention is retained by returning the same instance from
   * `intentions`, so it keeps its execution state; it is dropped by leaving it
   * out; it is created by returning a new instance. Retained Intentions must
   * not be recreated.
   */
  deliberate({
    beliefs,
    desires,
    intentions,
  }: DeliberationDeliberateArgs<
    TBeliefs,
    TDesire,
    TIntention
  >): readonly TIntention[];
}
