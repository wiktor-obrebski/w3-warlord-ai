import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { BeliefContainer, Controller } from "@lib/bdi";
import { debug } from "../../debug";
import {
  CommonBeliefModel,
  CommonBeliefs,
  lifeFractionOf,
  ownUnit,
} from "../../beliefs/common.beliefs";
import { TowerRushState } from "./tower-rush.state";
import {
  forgetSentToSafety,
  hideBehindClosestTower,
  isAvailableForwardPeasant,
} from "./forward-workers";
import {
  WorkerSafety,
  WorkerSafetyStatus,
} from "../maintain-worker-safety/worker-safety.ctrl";

// A repair starts below the start fraction and is not interrupted before the
// switch fraction; above it, a tower below the start fraction takes over,
// otherwise the repair goes on to full life.
const REPAIR_START_LIFE_FRACTION = 0.6;
const REPAIR_SWITCH_LIFE_FRACTION = 0.8;

/**
 * The forward Peasants repair the most damaged tower and hide behind the
 * towers when none needs repair or they are recovering from an attack.
 * Fleeing Peasants are left to worker safety. Only to be used once every rush
 * tower is built, so a tower's life fraction reflects damage, not build
 * progress.
 */
export class TowerMaintenanceController
  implements Controller<BeliefContainer>
{
  private readonly common: CommonBeliefModel;
  private readonly rush: TowerRushState;
  private readonly workerSafety: WorkerSafety;
  // The tower the forward Peasants are repairing.
  private repairTarget: W3UnitApi.unit | undefined;

  public constructor(
    common: CommonBeliefModel,
    rush: TowerRushState,
    workerSafety: WorkerSafety,
  ) {
    this.common = common;
    this.rush = rush;
    this.workerSafety = workerSafety;
  }

  public update(container: Readonly<BeliefContainer>) {
    const beliefs = container.get(this.common);
    const enemyMain = beliefs.enemyStartPosition;

    if (!enemyMain) {
      throw new Error("Tower rush: enemy start position not found.");
    }

    const towers = [...beliefs.scoutTowers, ...beliefs.guardTowers];
    const previousTarget = this.repairTarget;
    const repairTarget = chooseRepairTarget(towers, previousTarget, beliefs);
    const targetChanged = repairTarget !== previousTarget;
    this.repairTarget = repairTarget;

    if (targetChanged) {
      debug(
        repairTarget
          ? `Tower rush: repairing ${describeTower(repairTarget, beliefs)}.`
          : "Tower rush: no tower needs repair.",
      );
    }

    for (const worker of this.rush.forwardWorkers) {
      if (!beliefs.peasants.includes(worker)) {
        continue;
      }

      const safety = this.workerSafety.statusOf(worker, container);

      if (safety === WorkerSafetyStatus.Fleeing) {
        continue;
      }

      if (repairTarget && safety === WorkerSafetyStatus.Safe) {
        if (targetChanged || !beliefs.repairingUnits.includes(worker)) {
          orderRepair(worker, repairTarget, beliefs, this.rush);
        }
      } else if (
        isAvailableForwardPeasant(worker, beliefs) &&
        !this.rush.forwardWorkersSentToSafety.includes(worker)
      ) {
        hideBehindClosestTower(worker, towers, enemyMain, beliefs, this.rush);
      }
    }
  }
}

function chooseRepairTarget(
  towers: readonly W3UnitApi.unit[],
  current: W3UnitApi.unit | undefined,
  beliefs: Readonly<CommonBeliefs>,
): W3UnitApi.unit | undefined {
  const lifeFraction = (tower: W3UnitApi.unit) => lifeFractionOf(beliefs, tower);
  const currentStanding = current !== undefined && towers.includes(current);

  if (currentStanding && lifeFraction(current) < REPAIR_SWITCH_LIFE_FRACTION) {
    return current;
  }

  const mostDamaged = mostDamagedTower(
    towers.filter(
      (tower) =>
        tower !== current && lifeFraction(tower) < REPAIR_START_LIFE_FRACTION,
    ),
    beliefs,
  );

  if (mostDamaged) {
    return mostDamaged;
  }

  return currentStanding && lifeFraction(current) < 1 ? current : undefined;
}

function mostDamagedTower(
  towers: readonly W3UnitApi.unit[],
  beliefs: Readonly<CommonBeliefs>,
): W3UnitApi.unit | undefined {
  let mostDamaged: W3UnitApi.unit | undefined;

  for (const tower of towers) {
    if (
      !mostDamaged ||
      lifeFractionOf(beliefs, tower) < lifeFractionOf(beliefs, mostDamaged)
    ) {
      mostDamaged = tower;
    }
  }

  return mostDamaged;
}

function orderRepair(
  worker: W3UnitApi.unit,
  tower: W3UnitApi.unit,
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
) {
  if (W3UnitApi.IssueTargetOrder(worker, "repair", tower)) {
    forgetSentToSafety(worker, rush);
  } else {
    debug(
      `Tower rush: repair order rejected for ${describeTower(tower, beliefs)}.`,
    );
  }
}

function describeTower(
  tower: W3UnitApi.unit,
  beliefs: Readonly<CommonBeliefs>,
): string {
  const { life, maxLife } = ownUnit(beliefs, tower);

  return `a tower at ${Math.floor(life)}/${Math.floor(maxLife)} life`;
}
