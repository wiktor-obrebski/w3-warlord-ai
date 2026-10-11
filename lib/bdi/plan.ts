import type { ActorControlProvider } from "./actor-control";
import type { ExecutionComponent } from "./execution-component";

/**
 * Lifecycle status of a Plan. A Plan starts `"running"` and ends either
 * `"succeeded"` or `"failed"`.
 */
export type PlanStatus = "running" | "succeeded" | "failed";

/**
 * Finite procedural execution that progresses towards eventual success or
 * failure.
 *
 * A Plan owns its procedural execution state.
 */
export interface Plan<TBeliefs, TActor> extends ExecutionComponent {
  /**
   * Current lifecycle status. It changes only during `update()`; reading it
   * inspects state and does not re-evaluate the Plan.
   */
  readonly status: PlanStatus;

  /**
   * Advances the Plan while it is running. It may order only the Actors
   * `control` grants it.
   */
  update(beliefs: Readonly<TBeliefs>, control: ActorControlProvider<TActor>): void;
}
