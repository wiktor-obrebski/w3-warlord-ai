import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { debug } from "../../debug";
import { WorldState } from "../../perception/world-state";
import { TowerRushContext } from "./tower-rush-context";
import {
  forgetSentToSafety,
  hideBehindClosestTower,
  isAvailableForwardPeasant,
} from "./forward-workers";

// A repair starts below the start fraction and is not interrupted before the
// switch fraction; above it, a tower below the start fraction takes over,
// otherwise the repair goes on to full life.
const REPAIR_START_LIFE_FRACTION = 0.6;
const REPAIR_SWITCH_LIFE_FRACTION = 0.8;

// The forward Peasants repair the most damaged tower and hide behind the
// towers when none needs repair. Only used once every rush tower is built,
// so a tower's life fraction reflects damage, not build progress.
export function maintainTowers(world: WorldState, context: TowerRushContext) {
  const enemyMain = world.enemyStartPosition;

  if (!enemyMain) {
    throw new Error("Tower rush: enemy start position not found.");
  }

  const towers = [...world.scoutTowers, ...world.guardTowers];
  const previousTarget = context.repairTarget;
  const repairTarget = chooseRepairTarget(towers, previousTarget);
  const targetChanged = repairTarget !== previousTarget;
  context.repairTarget = repairTarget;

  if (targetChanged) {
    debug(
      repairTarget
        ? `Tower rush: repairing ${describeTower(repairTarget)}.`
        : "Tower rush: no tower needs repair.",
    );
  }

  for (const worker of context.forwardWorkers) {
    if (!world.peasants.includes(worker)) {
      continue;
    }

    if (repairTarget) {
      if (targetChanged || !world.repairingUnits.includes(worker)) {
        orderRepair(worker, repairTarget, context);
      }
    } else if (
      isAvailableForwardPeasant(worker, world) &&
      !context.forwardWorkersSentToSafety.includes(worker)
    ) {
      hideBehindClosestTower(worker, towers, enemyMain, context);
    }
  }
}

function chooseRepairTarget(
  towers: W3UnitApi.unit[],
  current: W3UnitApi.unit | undefined,
): W3UnitApi.unit | undefined {
  const currentStanding = current !== undefined && towers.includes(current);

  if (currentStanding && lifeFraction(current) < REPAIR_SWITCH_LIFE_FRACTION) {
    return current;
  }

  const mostDamaged = mostDamagedTower(
    towers.filter(
      (tower) =>
        tower !== current && lifeFraction(tower) < REPAIR_START_LIFE_FRACTION,
    ),
  );

  if (mostDamaged) {
    return mostDamaged;
  }

  return currentStanding && lifeFraction(current) < 1 ? current : undefined;
}

function mostDamagedTower(
  towers: W3UnitApi.unit[],
): W3UnitApi.unit | undefined {
  let mostDamaged: W3UnitApi.unit | undefined;

  for (const tower of towers) {
    if (!mostDamaged || lifeFraction(tower) < lifeFraction(mostDamaged)) {
      mostDamaged = tower;
    }
  }

  return mostDamaged;
}

function orderRepair(
  worker: W3UnitApi.unit,
  tower: W3UnitApi.unit,
  context: TowerRushContext,
) {
  if (W3UnitApi.IssueTargetOrder(worker, "repair", tower)) {
    forgetSentToSafety(worker, context);
  } else {
    debug(`Tower rush: repair order rejected for ${describeTower(tower)}.`);
  }
}

function describeTower(tower: W3UnitApi.unit): string {
  const life = W3UnitApi.GetUnitState(tower, W3UnitApi.UNIT_STATE_LIFE);
  const maxLife = W3UnitApi.GetUnitState(tower, W3UnitApi.UNIT_STATE_MAX_LIFE);

  return `a tower at ${Math.floor(life)}/${Math.floor(maxLife)} life`;
}

function lifeFraction(unit: W3UnitApi.unit): number {
  return (
    W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_LIFE) /
    W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_MAX_LIFE)
  );
}
