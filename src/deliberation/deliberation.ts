import { Deliberation, Desire, Intention } from "@lib/bdi";
import { GlobalBeliefs } from "../beliefs/global.beliefs";
import { ApplyPressure } from "../desires/apply-pressure";
import { ProtectEconomicAssets } from "../desires/protect-economic-assets";
import { UseMilitaryAssetsEffectively } from "../desires/use-military-assets-effectively";
import { MaintainWorkerSafetyIntention } from "../intentions/maintain-worker-safety/maintain-worker-safety.intention";
import { TowerRushIntention } from "../intentions/tower-rush/tower-rush.intention";
import { OperateTowersIntention } from "../intentions/operate-towers/operate-towers.intention";

export type WarlordIntention = Intention<GlobalBeliefs>;

/**
 * A fixed policy for now:
 *
 * - ProtectEconomicAssets → MaintainWorkerSafety
 * - ApplyPressure → TowerRush
 * - UseMilitaryAssetsEffectively → OperateTowers, once the tower rush has
 *   established its Guard Tower position
 *
 * Intentions are returned in update order. Worker safety comes first so the
 * others see which workers it has taken over on the same tick.
 */
export class WarlordDeliberation
  implements Deliberation<GlobalBeliefs, Desire, WarlordIntention>
{
  public deliberate(
    _beliefs: Readonly<GlobalBeliefs>,
    desires: readonly Desire[],
    intentions: readonly WarlordIntention[],
  ): readonly WarlordIntention[] {
    const active: WarlordIntention[] = [];
    let workerSafety: MaintainWorkerSafetyIntention | undefined;
    let towerRush: TowerRushIntention | undefined;

    if (desires.includes(ProtectEconomicAssets)) {
      workerSafety =
        find(intentions, MaintainWorkerSafetyIntention) ??
        new MaintainWorkerSafetyIntention();
      active.push(workerSafety);
    }

    if (desires.includes(ApplyPressure)) {
      const safety = requireWorkerSafety(workerSafety);

      towerRush =
        find(intentions, TowerRushIntention) ?? new TowerRushIntention(safety);
      active.push(towerRush);
    }

    if (desires.includes(UseMilitaryAssetsEffectively)) {
      const operateTowers =
        find(intentions, OperateTowersIntention) ??
        (towerRush?.positionEstablished
          ? new OperateTowersIntention()
          : undefined);

      if (operateTowers) {
        active.push(operateTowers);
      }
    }

    return active;
  }
}

function find<T extends WarlordIntention>(
  intentions: readonly WarlordIntention[],
  type: new (...args: never[]) => T,
): T | undefined {
  for (const intention of intentions) {
    if (intention instanceof type) {
      return intention;
    }
  }

  return undefined;
}

// The tower rush leaves workers to worker safety while they are in danger and
// keeps consulting the instance it was created with, so worker safety must
// stay retained for as long as the tower rush is.
function requireWorkerSafety(
  workerSafety: MaintainWorkerSafetyIntention | undefined,
): MaintainWorkerSafetyIntention {
  if (!workerSafety) {
    throw new Error(
      "Deliberation: TowerRush requires the MaintainWorkerSafety intention.",
    );
  }

  return workerSafety;
}
