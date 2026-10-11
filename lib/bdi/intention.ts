import type { Controller } from "./controller";
import type { ExecutionComponent } from "./execution-component";
import type { Plan } from "./plan";

/**
 * Updates one of an Intention's Plans or Controllers with the cycle's
 * Beliefs and actor control scoped to that child.
 */
export type UpdateChild<TBeliefs, TControl> = (
  child: Plan<TBeliefs, TControl> | Controller<TBeliefs, TControl>,
) => void;

/**
 * A concrete commitment the agent is currently pursuing.
 *
 * An Intention stays active for as long as Deliberation retains it; it has no
 * success or failure status of its own. It may own Plans, Controllers, and
 * other execution state.
 */
export interface Intention<TBeliefs, TControl> extends ExecutionComponent {
  /**
   * Makes progress on the commitment, once per cycle while retained. It
   * decides which of its children to update, and updates them only through
   * `updateChild`.
   */
  update(
    beliefs: Readonly<TBeliefs>,
    updateChild: UpdateChild<TBeliefs, TControl>,
  ): void;
}
