import { BeliefContainer, Deliberation, Desire, Intention } from "@lib/bdi";
import { Actor } from "../actor";
import { CommonBeliefModel } from "../beliefs/common.beliefs";
import { ApplyPressure } from "../desires/apply-pressure";
import { ProtectEconomicAssets } from "../desires/protect-economic-assets";
import { UseMilitaryAssetsEffectively } from "../desires/use-military-assets-effectively";
import { MaintainWorkerSafetyIntention } from "../intentions/maintain-worker-safety/maintain-worker-safety.intention";
import { TowerRushIntention } from "../intentions/tower-rush/tower-rush.intention";
import { OperateTowersIntention } from "../intentions/operate-towers/operate-towers.intention";

export type WarlordIntention = Intention<BeliefContainer, Actor>;

/**
 * A fixed policy for now:
 *
 * - ProtectEconomicAssets → MaintainWorkerSafety
 * - ApplyPressure → TowerRush
 * - UseMilitaryAssetsEffectively → OperateTowers, once the tower rush has
 *   established its Guard Tower position
 *
 * Intentions are returned in update order. Worker safety comes first so it
 * takes attacked workers over before the others order them on the same tick.
 */
export function createDeliberation(
  common: CommonBeliefModel,
): Deliberation<BeliefContainer, Desire, WarlordIntention> {
  return {
    deliberate(_beliefs, desires, intentions) {
      const active: WarlordIntention[] = [];
      let towerRush: TowerRushIntention | undefined;

      if (desires.includes(ProtectEconomicAssets)) {
        active.push(
          find(intentions, MaintainWorkerSafetyIntention) ??
            new MaintainWorkerSafetyIntention(common),
        );
      }

      if (desires.includes(ApplyPressure)) {
        towerRush =
          find(intentions, TowerRushIntention) ??
          new TowerRushIntention(common);
        active.push(towerRush);
      }

      if (desires.includes(UseMilitaryAssetsEffectively)) {
        const operateTowers =
          find(intentions, OperateTowersIntention) ??
          (towerRush?.positionEstablished
            ? new OperateTowersIntention(common)
            : undefined);

        if (operateTowers) {
          active.push(operateTowers);
        }
      }

      return active;
    },
  };
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
