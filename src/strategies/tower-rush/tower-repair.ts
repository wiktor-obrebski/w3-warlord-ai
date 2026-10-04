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
// towers when none needs repair.
export function maintainTowers(world: WorldState, context: TowerRushContext) {
  const enemyMain = world.enemyStartPosition;

  if (!enemyMain) {
    throw new Error("Tower rush: enemy start position not found.");
  }

  const towers = [...world.scoutTowers, ...world.guardTowers];
  const previousTarget = context.repairTarget;
  const repairTarget = chooseRepairTarget(
    repairableTowers(towers, world),
    previousTarget,
  );
  const targetChanged = repairTarget !== previousTarget;
  context.repairTarget = repairTarget;

  if (targetChanged) {
    debug(
      repairTarget
        ? `Tower rush: repairing a tower at ${Math.floor(lifeFraction(repairTarget) * 100)}% life.`
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

// The life fraction of a tower under construction reflects build progress,
// not damage. An upgrading tower is left alone too: whether its life
// fraction is meaningful during the upgrade, and whether Peasants can repair
// it then, is not verified in-game.
function repairableTowers(
  towers: W3UnitApi.unit[],
  world: WorldState,
): W3UnitApi.unit[] {
  return towers.filter(
    (tower) =>
      !world.buildingsUnderConstruction.includes(tower) &&
      !world.buildingsUpgrading.includes(tower),
  );
}

function chooseRepairTarget(
  repairable: W3UnitApi.unit[],
  current: W3UnitApi.unit | undefined,
): W3UnitApi.unit | undefined {
  const currentRepairable =
    current !== undefined && repairable.includes(current);

  if (currentRepairable && lifeFraction(current) < REPAIR_SWITCH_LIFE_FRACTION) {
    return current;
  }

  const mostDamaged = mostDamagedTower(
    repairable.filter(
      (tower) =>
        tower !== current && lifeFraction(tower) < REPAIR_START_LIFE_FRACTION,
    ),
  );

  if (mostDamaged) {
    return mostDamaged;
  }

  return currentRepairable && lifeFraction(current) < 1 ? current : undefined;
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
    debug("Tower rush: repair order rejected.");
  }
}

function lifeFraction(unit: W3UnitApi.unit): number {
  return (
    W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_LIFE) /
    W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_MAX_LIFE)
  );
}
