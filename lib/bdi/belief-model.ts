/**
 * Produces one kind of Beliefs from what the agent can currently observe and
 * from other Beliefs it depends on.
 *
 * A model instance is the identity of its belief state: the belief runtime
 * keeps one current Beliefs value per active model instance. Two components
 * that need independent Beliefs of the same kind create separate instances,
 * typically configured with what each component is responsible for.
 *
 * A model never invokes another model; the belief runtime revises its
 * dependencies first and passes their current Beliefs to `revise()`.
 */
export interface BeliefModel<TObservation, TBeliefs, TDependencies = undefined> {
  /**
   * The model instances whose current Beliefs `revise()` receives, under the
   * same keys. `undefined` for a model without dependencies. Dependencies
   * must be acyclic.
   */
  readonly dependencies: BeliefDependencies<TDependencies>;

  /**
   * Reads what the agent can currently observe of the external environment.
   */
  observe(): TObservation;

  /**
   * Combines the previous Beliefs with the current Observation and the
   * current Beliefs of the dependencies into the next Beliefs. `previous` is
   * undefined the first time the model is revised.
   *
   * Must not mutate any of its inputs. Should return `previous` itself when
   * nothing changed, and reuse unchanged nested values otherwise.
   */
  revise(
    previous: Readonly<TBeliefs> | undefined,
    observation: Readonly<TObservation>,
    dependencies: Readonly<TDependencies>,
  ): TBeliefs;
}

/**
 * For each dependency key, the model instance providing its Beliefs.
 */
export type BeliefDependencies<TDependencies> = {
  readonly [K in keyof TDependencies]: AnyBeliefModel<TDependencies[K]>;
};

/**
 * A BeliefModel producing `TBeliefs`, whatever it observes or depends on.
 */
export interface AnyBeliefModel<TBeliefs = unknown> {
  readonly dependencies:
    | { readonly [key: string]: AnyBeliefModel }
    | undefined;
  observe(): unknown;
  revise(previous: unknown, observation: unknown, dependencies: unknown): TBeliefs;
}
