import type { Controller } from './controller';
import type { Plan } from './plan';

export { type UpdateChild, type Intention };

interface UpdateChildArgs<TChildBeliefs> {
  child: Plan<TChildBeliefs> | Controller<TChildBeliefs>;
}

/**
 * Updates one of an Intention's Plans or Controllers with that child's own
 * Beliefs, with the child's actor control scoped to it.
 */
type UpdateChild<TChildBeliefs> = ({
  child,
}: UpdateChildArgs<TChildBeliefs>) => void;

interface IntentionUpdateArgs<TBeliefs, TChildBeliefs> {
  beliefs: Readonly<TBeliefs>;
  updateChild: UpdateChild<TChildBeliefs>;
}

interface IntentionAssessCommitmentArgs<TCommonBeliefs, TDesire> {
  commonBeliefs: Readonly<TCommonBeliefs>;
  desire: TDesire | null;
}

/**
 * A concrete commitment the agent is currently pursuing.
 *
 * An Intention stays active for as long as Deliberation retains it; it has no
 * success or failure status of its own. It may own Plans, Controllers, and
 * other execution state. `TChildBeliefs` is the Beliefs type its children
 * are updated with, whatever Scoped Beliefs each has; `TCommonBeliefs` the
 * Common Beliefs its commitment is assessed with; `TDesire` the Desire it
 * may be adopted for.
 */
interface Intention<
  TBeliefs,
  TChildBeliefs = TBeliefs,
  TCommonBeliefs = TBeliefs,
  TDesire = unknown,
> {
  /**
   * Makes progress on the commitment, once per cycle while retained. It
   * decides which of its children to update, and updates them only through
   * `updateChild`.
   */
  update({
    beliefs,
    updateChild,
  }: IntentionUpdateArgs<TBeliefs, TChildBeliefs>): void;

  /**
   * Whether maintaining this commitment remains worthwhile, judged from the
   * Intention's own objective, progress, and circumstances, not against
   * competing commitments. `desire` is the Desire it was adopted for, or
   * null once that Desire is gone, which calls for reconsideration rather
   * than ending the commitment by itself.
   *
   * Deliberation weighs the answer; the assessment changes nothing itself:
   * it does not end the Intention, release what it holds, or order Actors.
   */
  assessCommitment({
    commonBeliefs,
    desire,
  }: IntentionAssessCommitmentArgs<TCommonBeliefs, TDesire>): boolean;
}
