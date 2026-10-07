import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { debug } from "../../debug";
import { Point, Vector } from "@lib/math";
import { CommonBeliefs, positionOf } from "../../beliefs/common.beliefs";
import { TowerRushState } from "./tower-rush.state";
import {
  isWorkerSafe,
  WorkerSafety,
} from "../maintain-worker-safety/worker-safety.ctrl";

// Clears the tower's 128x128 footprint with room for the Peasant.
const HIDING_DISTANCE_BEHIND_TOWER = 160;

export function hideBehindClosestTower(
  worker: W3UnitApi.unit,
  towers: readonly W3UnitApi.unit[],
  enemyMain: Point,
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
) {
  const shelter = closestUnit(towers, worker, beliefs);

  if (!shelter) {
    return;
  }

  const spot = spotBehind(positionOf(beliefs, shelter), enemyMain);

  if (W3UnitApi.IssuePointOrder(worker, "move", spot.x, spot.y)) {
    rush.forwardWorkersSentToSafety.push(worker);
    debug("Tower rush: forward Peasant hides behind a tower.");
  } else {
    debug("Tower rush: move to safety rejected.");
  }
}

export function forgetSentToSafety(worker: W3UnitApi.unit, rush: TowerRushState) {
  rush.forwardWorkersSentToSafety = rush.forwardWorkersSentToSafety.filter(
    (sent) => sent !== worker,
  );
}

// An attacked Peasant may have fled its hiding spot, so it is sent to hide
// again. A flee round can start and end between two tower rush updates, so
// this does not wait to see the Peasant fleeing.
export function forgetHidingOfUnsafeWorkers(
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
  workerSafety: WorkerSafety,
) {
  rush.forwardWorkersSentToSafety = rush.forwardWorkersSentToSafety.filter(
    (worker) => isWorkerSafe(workerSafety, worker, beliefs.time),
  );
}

// Idle, holding, or sent back to harvesting; anything else means the Peasant
// is busy with an order of its own, such as building or repairing.
export function isAvailableForwardPeasant(
  worker: W3UnitApi.unit,
  beliefs: Readonly<CommonBeliefs>,
): boolean {
  return (
    beliefs.peasants.includes(worker) &&
    (beliefs.idleUnits.includes(worker) ||
      beliefs.holdingPositionUnits.includes(worker) ||
      beliefs.harvestingUnits.includes(worker))
  );
}

// On the far side of the tower as seen from the enemy main hall.
function spotBehind(tower: Point, enemyMain: Point): Point {
  const awayFromEnemyMain = new Vector(enemyMain, tower).normalize();

  return tower.translate(
    awayFromEnemyMain.multiply(HIDING_DISTANCE_BEHIND_TOWER),
  );
}

export function closestUnit(
  units: readonly W3UnitApi.unit[],
  to: W3UnitApi.unit,
  beliefs: Readonly<CommonBeliefs>,
): W3UnitApi.unit | undefined {
  const origin = positionOf(beliefs, to);
  let closest: W3UnitApi.unit | undefined;
  let closestDistance = Infinity;

  for (const unit of units) {
    const distance = new Vector(origin, positionOf(beliefs, unit)).length;

    if (distance < closestDistance) {
      closest = unit;
      closestDistance = distance;
    }
  }

  return closest;
}
