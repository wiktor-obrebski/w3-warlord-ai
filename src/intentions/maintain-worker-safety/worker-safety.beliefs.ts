import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { BeliefsModel } from '@lib/bdi';
import { CommonBeliefs } from '../../beliefs/common.beliefs';
import { isRecentlyAttacked } from '../../beliefs/common.assessments';

export { type WorkerSafetyBeliefs, workerSafetyBeliefsModel };

// A worker unattacked for this long is safe again.
const SafeAfterAttackSeconds = 1;

const NoAttacks: ReadonlyMap<W3UnitApi.unit, number> = new Map();

interface WorkerSafetyBeliefs {
  // When each worker attacked within the last SafeAfterAttackSeconds was
  // last attacked.
  readonly lastAttackedAt: ReadonlyMap<W3UnitApi.unit, number>;
}

/**
 * Which workers were attacked recently enough not to be safe yet. It
 * observes nothing itself: attacks come from the Common Beliefs.
 */
const workerSafetyBeliefsModel: BeliefsModel<
  null,
  WorkerSafetyBeliefs,
  CommonBeliefs
> = {
  observe() {
    return null;
  },

  // Copied only when an attack is recorded or forgotten, so the beliefs stay
  // the same object while no worker is under attack.
  revise({ previous, commonBeliefs }) {
    const known = previous?.lastAttackedAt ?? NoAttacks;
    let revised: Map<W3UnitApi.unit, number> | undefined;

    for (const worker of commonBeliefs.workers) {
      if (
        isRecentlyAttacked({
          beliefs: commonBeliefs,
          attackedUnit: worker.unit,
        }) &&
        known.get(worker.unit) !== commonBeliefs.time
      ) {
        revised ??= new Map(known);
        revised.set(worker.unit, commonBeliefs.time);
      }
    }

    for (const [worker, attackedAt] of known) {
      const isWorker = commonBeliefs.workers.some(
        (livingWorker) => livingWorker.unit === worker
      );

      if (
        !isWorker ||
        commonBeliefs.time - attackedAt >= SafeAfterAttackSeconds
      ) {
        revised ??= new Map(known);
        revised.delete(worker);
      }
    }

    if (revised) {
      return { lastAttackedAt: revised };
    }

    return previous ?? { lastAttackedAt: NoAttacks };
  },
};
