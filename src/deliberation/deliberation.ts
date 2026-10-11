import { Deliberation, Desire } from "@lib/bdi";
import { CommonBeliefs } from "../beliefs/common.beliefs";
import { ProvidedComponent, WarlordIntention } from "../execution";
import { ApplyPressure } from "../desires/apply-pressure";
import { ProtectEconomicAssets } from "../desires/protect-economic-assets";
import { UseMilitaryAssetsEffectively } from "../desires/use-military-assets-effectively";
import { provideMaintainWorkerSafetyIntention } from "../intentions/maintain-worker-safety/maintain-worker-safety.intention";
import {
  provideTowerRushIntention,
  TowerRushIntention,
} from "../intentions/tower-rush/tower-rush.intention";
import { provideOperateTowersIntention } from "../intentions/operate-towers/operate-towers.intention";

/** An Intention as its provider created it. */
export type ProvidedIntention = ProvidedComponent<WarlordIntention<unknown>>;

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
 *
 * Deliberation remembers the Intentions it provided, so it can tell them
 * apart and read their state; one is retained while it is still active.
 */
export function createDeliberation(): Deliberation<
  CommonBeliefs,
  Desire,
  ProvidedIntention
> {
  let workerSafety: ProvidedIntention | null = null;
  let towerRush: ProvidedComponent<TowerRushIntention> | null = null;
  let operateTowers: ProvidedIntention | null = null;

  return {
    deliberate(_beliefs, desires, intentions) {
      const retained = <T extends ProvidedIntention>(intention: T | null) =>
        intention !== null && intentions.includes(intention) ? intention : null;
      const active: ProvidedIntention[] = [];

      workerSafety = desires.includes(ProtectEconomicAssets)
        ? (retained(workerSafety) ?? provideMaintainWorkerSafetyIntention())
        : null;
      towerRush = desires.includes(ApplyPressure)
        ? (retained(towerRush) ?? provideTowerRushIntention())
        : null;
      operateTowers = desires.includes(UseMilitaryAssetsEffectively)
        ? (retained(operateTowers) ??
          (towerRush?.value.positionEstablished
            ? provideOperateTowersIntention()
            : null))
        : null;

      // Pushed one by one: in Lua, null elements of an array literal leave
      // holes that end iteration early.
      if (workerSafety) {
        active.push(workerSafety);
      }

      if (towerRush) {
        active.push(towerRush);
      }

      if (operateTowers) {
        active.push(operateTowers);
      }

      return active;
    },
  };
}
