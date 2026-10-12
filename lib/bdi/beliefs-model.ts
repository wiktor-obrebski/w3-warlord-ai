export { type CommonBeliefsModel, type BeliefsModel, type AnyBeliefsModel };

/**
 * Maintains the agent's Common Beliefs: knowledge shared by every
 * Intention, Plan, and Controller.
 */
interface CommonBeliefsModel<TObservation, TCommonBeliefs> {
  /**
   * Reads what the agent can currently observe of the external environment.
   */
  observe(): TObservation;

  /**
   * Combines the previous Common Beliefs with the current Observation into
   * the next ones. `previous` is null the first time.
   *
   * Must not mutate its inputs. Should return `previous` itself when nothing
   * changed, and reuse unchanged nested values otherwise.
   */
  revise({
    previous,
    observation,
  }: {
    previous: Readonly<TCommonBeliefs> | null;
    observation: Readonly<TObservation>;
  }): TCommonBeliefs;
}

/**
 * Maintains the Scoped Beliefs of an Intention, Plan, or Controller: belief
 * state private to one component instance.
 *
 * A model is behavior without state, so one model may serve any number of
 * component instances; each instance still has its own Scoped Beliefs,
 * revised from its own previous ones.
 */
interface BeliefsModel<TObservation, TBeliefs, TCommonBeliefs> {
  /**
   * Reads what the model needs to observe of the external environment.
   */
  observe(): TObservation;

  /**
   * Combines the component's previous Scoped Beliefs with the current
   * Observation and the current Common Beliefs into its next Scoped Beliefs.
   * `previous` is null on the component's first revision, which creates its
   * initial Beliefs. The result must not be null.
   *
   * Must not mutate its inputs. Should return `previous` itself when nothing
   * changed, and reuse unchanged nested values otherwise.
   */
  revise({
    previous,
    observation,
    common,
  }: {
    previous: Readonly<TBeliefs> | null;
    observation: Readonly<TObservation>;
    common: Readonly<TCommonBeliefs>;
  }): TBeliefs;
}

/**
 * A BeliefsModel whatever it observes or produces, as the beliefs runtime
 * handles it.
 */
interface AnyBeliefsModel<TCommonBeliefs> {
  observe(): unknown;
  revise({
    previous,
    observation,
    common,
  }: {
    previous: unknown;
    observation: unknown;
    common: Readonly<TCommonBeliefs>;
  }): unknown;
}
