export { type PlanStatus, type Plan };

/**
 * Lifecycle status of a Plan. A Plan starts `"running"` and ends either
 * `"succeeded"` or `"failed"`.
 */
type PlanStatus = 'running' | 'succeeded' | 'failed';

interface PlanUpdateArgs<TBeliefs> {
  beliefs: Readonly<TBeliefs>;
}

/**
 * Finite procedural execution that progresses towards eventual success or
 * failure.
 *
 * A Plan owns its procedural execution state. `TBeliefs` is the Beliefs it
 * reads, normally `ComponentBeliefs`. Whatever else it needs, such as actor
 * control, it receives as capabilities when it is assembled.
 */
interface Plan<TBeliefs> {
  /**
   * Current lifecycle status. It changes only during `update()`; reading it
   * inspects state and does not re-evaluate the Plan.
   */
  readonly status: PlanStatus;

  /**
   * Advances the Plan while it is running. It may order only the Actors its
   * actor control grants it during this update.
   */
  update({ beliefs }: PlanUpdateArgs<TBeliefs>): void;
}
