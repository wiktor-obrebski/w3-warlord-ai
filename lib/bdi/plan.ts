export { type PlanStatus, type Plan };

/**
 * Lifecycle status of a Plan. A Plan starts `"running"` and ends either
 * `"succeeded"` or `"failed"`.
 */
type PlanStatus = 'running' | 'succeeded' | 'failed';

interface PlanUpdateArgs<TBeliefs, TActorControl> {
  beliefs: Readonly<TBeliefs>;
  actorControl: TActorControl;
}

/**
 * Finite procedural execution that progresses towards eventual success or
 * failure.
 *
 * A Plan owns its procedural execution state. `TBeliefs` is the Beliefs it
 * reads, normally `ComponentBeliefs`; `TActorControl` is the agent's actor control
 * capability, normally an `ActorControlProvider`.
 */
interface Plan<TBeliefs, TActorControl> {
  /**
   * Current lifecycle status. It changes only during `update()`; reading it
   * inspects state and does not re-evaluate the Plan.
   */
  readonly status: PlanStatus;

  /**
   * Advances the Plan while it is running. It may order only the Actors
   * `actorControl` grants it.
   */
  update({
    beliefs,
    actorControl,
  }: PlanUpdateArgs<TBeliefs, TActorControl>): void;
}
