/**
 * Produces the agent's Beliefs from what it can currently observe.
 *
 * Each cycle the agent observes once and revises its previous Beliefs with
 * that Observation. The resulting Beliefs are a snapshot that stays unchanged
 * for the rest of the cycle.
 */
export interface BeliefModel<TObservation, TBeliefs> {
  /**
   * Reads what the agent can currently observe.
   */
  observe(): TObservation;

  /**
   * Combines the previous Beliefs with the current Observation into the next
   * Beliefs. `previous` is undefined on the first cycle.
   *
   * Must not mutate `previous` or `observation`. May return `previous`
   * unchanged when the Observation changes nothing.
   */
  revise(
    previous: Readonly<TBeliefs> | undefined,
    observation: Readonly<TObservation>,
  ): TBeliefs;
}
