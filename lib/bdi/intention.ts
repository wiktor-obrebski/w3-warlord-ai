import type { ExecutionComponent } from "./execution-component";

/**
 * A concrete commitment the agent is currently pursuing.
 *
 * An Intention stays active for as long as Deliberation retains it; it has no
 * success or failure status of its own. It may own Plans, Controllers, and
 * other execution state.
 */
export interface Intention<TBeliefs> extends ExecutionComponent {
  /**
   * Makes progress on the commitment, once per cycle while retained.
   */
  update(beliefs: Readonly<TBeliefs>): void;
}
