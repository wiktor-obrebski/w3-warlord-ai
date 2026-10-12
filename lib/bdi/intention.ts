import type { Controller } from './controller';
import type { Plan } from './plan';

export { type UpdateChild, type Intention };

/**
 * Updates one of an Intention's Plans or Controllers with that child's own
 * Beliefs and actor control scoped to it.
 */
type UpdateChild<TChildBeliefs, TControl> = ({
  child,
}: {
  child: Plan<TChildBeliefs, TControl> | Controller<TChildBeliefs, TControl>;
}) => void;

/**
 * A concrete commitment the agent is currently pursuing.
 *
 * An Intention stays active for as long as Deliberation retains it; it has no
 * success or failure status of its own. It may own Plans, Controllers, and
 * other execution state. `TChildBeliefs` is the Beliefs type its children
 * are updated with, whatever Scoped Beliefs each has.
 */
interface Intention<TBeliefs, TControl, TChildBeliefs = TBeliefs> {
  /**
   * Makes progress on the commitment, once per cycle while retained. It
   * decides which of its children to update, and updates them only through
   * `updateChild`.
   */
  update({
    beliefs,
    updateChild,
  }: {
    beliefs: Readonly<TBeliefs>;
    updateChild: UpdateChild<TChildBeliefs, TControl>;
  }): void;
}
