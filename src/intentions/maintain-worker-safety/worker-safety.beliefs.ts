import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { AnyBeliefModel, BeliefDependencies, BeliefModel } from "@lib/bdi";
import { CommonBeliefs } from "../../beliefs/common.beliefs";
import { isRecentlyAttacked } from "../../beliefs/common.assessments";

// A worker unattacked for this long is safe again.
const SAFE_AFTER_ATTACK_SECONDS = 2;

const NO_ATTACKS: ReadonlyMap<W3UnitApi.unit, number> = new Map();

export interface WorkerSafetyBeliefs {
  // When each worker attacked within the last SAFE_AFTER_ATTACK_SECONDS was
  // last attacked.
  readonly lastAttackedAt: ReadonlyMap<W3UnitApi.unit, number>;
}

interface Dependencies {
  common: CommonBeliefs;
}

/** Which workers were attacked recently enough not to be safe yet. */
export class WorkerSafetyBeliefModel
  implements BeliefModel<undefined, WorkerSafetyBeliefs, Dependencies>
{
  public readonly dependencies: BeliefDependencies<Dependencies>;

  public constructor(common: AnyBeliefModel<CommonBeliefs>) {
    this.dependencies = { common };
  }

  public observe() {
    return undefined;
  }

  // Copied only when an attack is recorded or forgotten, so the beliefs stay
  // the same object while no worker is under attack.
  public revise(
    previous: Readonly<WorkerSafetyBeliefs> | undefined,
    _observation: undefined,
    { common }: Readonly<Dependencies>,
  ): WorkerSafetyBeliefs {
    const known = previous?.lastAttackedAt ?? NO_ATTACKS;
    let revised: Map<W3UnitApi.unit, number> | undefined;

    for (const worker of common.workers) {
      if (
        isRecentlyAttacked(common, worker.unit) &&
        known.get(worker.unit) !== common.time
      ) {
        revised ??= new Map(known);
        revised.set(worker.unit, common.time);
      }
    }

    for (const [worker, attackedAt] of known) {
      const isWorker = common.workers.some((alive) => alive.unit === worker);

      if (!isWorker || common.time - attackedAt >= SAFE_AFTER_ATTACK_SECONDS) {
        revised ??= new Map(known);
        revised.delete(worker);
      }
    }

    if (revised) {
      return { lastAttackedAt: revised };
    }

    return previous ?? { lastAttackedAt: NO_ATTACKS };
  }
}
