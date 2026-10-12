export { type CommonBeliefsModel, type BeliefsModel };

interface CommonBeliefsModelReviseArgs<TCommonBeliefs, TObservation> {
  previous: Readonly<TCommonBeliefs> | null;
  observation: Readonly<TObservation>;
}

/**
 * Maintains the agent's Common Beliefs: knowledge shared by every
 * Intention, Plan, and Controller.
 */
interface CommonBeliefsModel<TCommonBeliefs, TObservation = unknown> {
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
  }: CommonBeliefsModelReviseArgs<
    TCommonBeliefs,
    TObservation
  >): TCommonBeliefs;
}

/**
 * `Readonly<T>`, except that `unknown` stays `unknown`.
 *
 * `Readonly` maps over the properties of `T`, which turns `unknown` into
 * `{}`. The beliefs runtime handles every model as
 * `BeliefsModel<unknown, TCommonBeliefs>` and so passes `unknown` Beliefs and
 * Observations, which `{}` would reject.
 */
type Immutable<T> = unknown extends T ? T : Readonly<T>;

interface BeliefsModelReviseArgs<TBeliefs, TCommonBeliefs, TObservation> {
  previous: Immutable<TBeliefs> | null;
  observation: Immutable<TObservation>;
  commonBeliefs: Readonly<TCommonBeliefs>;
}

/**
 * Maintains the Scoped Beliefs of an Intention, Plan, or Controller: belief
 * state private to one component instance.
 *
 * A model is behavior without state, so one model may serve any number of
 * component instances; each instance still has its own Scoped Beliefs,
 * revised from its own previous ones.
 *
 * The beliefs runtime handles models of every Scoped Beliefs type alike, as
 * `BeliefsModel<unknown, TCommonBeliefs>`.
 */
interface BeliefsModel<
  TBeliefs,
  TCommonBeliefs = unknown,
  TObservation = unknown,
> {
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
    commonBeliefs,
  }: BeliefsModelReviseArgs<TBeliefs, TCommonBeliefs, TObservation>): TBeliefs;
}
