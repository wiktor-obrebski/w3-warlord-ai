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
  revise({ previous, common }) {
    const known = previous?.lastAttackedAt ?? NoAttacks;
    let revised: Map<W3UnitApi.unit, number> | undefined;

    for (const worker of common.workers) {
      if (
        isRecentlyAttacked({ beliefs: common, target: worker.unit }) &&
        known.get(worker.unit) !== common.time
      ) {
        revised ??= new Map(known);
        revised.set(worker.unit, common.time);
      }
    }

    for (const [worker, attackedAt] of known) {
      const isWorker = common.workers.some((alive) => alive.unit === worker);

      if (!isWorker || common.time - attackedAt >= SafeAfterAttackSeconds) {
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
