import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { debug } from "../../debug";
import { Point, WorldState } from "../../perception/world-state";
import { TowerRushContext } from "./tower-rush-context";

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
  const distance = distanceBetween(enemyMain, tower);

  return {
    x: tower.x + ((tower.x - enemyMain.x) / distance) * HIDING_DISTANCE_BEHIND_TOWER,
    y: tower.y + ((tower.y - enemyMain.y) / distance) * HIDING_DISTANCE_BEHIND_TOWER,
  };
}

export function closestUnit(
  units: W3UnitApi.unit[],
  to: W3UnitApi.unit,
): W3UnitApi.unit | undefined {
  const origin = positionOf(to);
  let closest: W3UnitApi.unit | undefined;
  let closestDistance = Infinity;

  for (const unit of units) {
    const distance = distanceBetween(origin, positionOf(unit));

    if (distance < closestDistance) {
      closest = unit;
      closestDistance = distance;
    }
  }

  return closest;
}

export function positionOf(unit: W3UnitApi.unit): Point {
  return { x: W3UnitApi.GetUnitX(unit), y: W3UnitApi.GetUnitY(unit) };
}

export function distanceBetween(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
