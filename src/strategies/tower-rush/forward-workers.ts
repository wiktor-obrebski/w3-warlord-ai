import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { debug } from "../../debug";
import { Point, Vector } from "@lib/math";
import { WorldState } from "../../perception/world-state";
import { TowerRushContext } from "./tower-rush-context";
import {
  isWorkerSafe,
  WorkerSafety,
} from "../../capabilities/worker-safety/worker-safety";

// Clears the tower's 128x128 footprint with room for the Peasant.
const HIDING_DISTANCE_BEHIND_TOWER = 160;

export function hideBehindClosestTower(
  worker: W3UnitApi.unit,
  towers: W3UnitApi.unit[],
  enemyMain: Point,
  context: TowerRushContext,
) {
  const shelter = closestUnit(towers, worker);

  if (!shelter) {
    return;
  }

  const spot = spotBehind(positionOf(shelter), enemyMain);

  if (W3UnitApi.IssuePointOrder(worker, "move", spot.x, spot.y)) {
    context.forwardWorkersSentToSafety.push(worker);
    debug("Tower rush: forward Peasant hides behind a tower.");
  } else {
    debug("Tower rush: move to safety rejected.");
  }
}

export function forgetSentToSafety(
  worker: W3UnitApi.unit,
  context: TowerRushContext,
) {
  context.forwardWorkersSentToSafety = context.forwardWorkersSentToSafety.filter(
    (sent) => sent !== worker,
  );
}

// An attacked Peasant may have fled its hiding spot, so it is sent to hide
// again. A flee round can start and end between two strategy updates, so
// this does not wait to see the Peasant fleeing.
export function forgetHidingOfUnsafeWorkers(
  world: WorldState,
  context: TowerRushContext,
  workerSafety: WorkerSafety,
) {
  context.forwardWorkersSentToSafety = context.forwardWorkersSentToSafety.filter(
    (worker) => isWorkerSafe(workerSafety, worker, world.time),
  );
}

// Idle, holding, or sent back to harvesting; anything else means the Peasant
// is busy with an order of its own, such as building or repairing.
export function isAvailableForwardPeasant(
  worker: W3UnitApi.unit,
  world: WorldState,
): boolean {
  return (
    world.peasants.includes(worker) &&
    (world.idleUnits.includes(worker) ||
      world.holdingPositionUnits.includes(worker) ||
      world.harvestingUnits.includes(worker))
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
  units: W3UnitApi.unit[],
  to: W3UnitApi.unit,
): W3UnitApi.unit | undefined {
  const origin = positionOf(to);
  let closest: W3UnitApi.unit | undefined;
  let closestDistance = Infinity;

  for (const unit of units) {
    const distance = new Vector(origin, positionOf(unit)).length;

    if (distance < closestDistance) {
      closest = unit;
      closestDistance = distance;
    }
  }

  return closest;
}

function positionOf(unit: W3UnitApi.unit): Point {
  return new Point(W3UnitApi.GetUnitX(unit), W3UnitApi.GetUnitY(unit));
}
