import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { debug } from "../../../debug";
import { WorldState } from "../../../perception/world-state";
import { TowerRushContext, TowerRushPhase } from "../tower-rush-context";

// A move order to a gold mine ends at the mine's edge, not its center.
const ARRIVAL_RADIUS = 400;

export function updateMovingToEnemy(
  world: WorldState,
  context: TowerRushContext,
) {
  holdArrivedMilitia(world, context);
  sendNewMilitiaToEnemy(world, context);

  if (forwardWorkersHaveRevertedToPeasants(world, context)) {
    context.phase = TowerRushPhase.BuildingTowers;
  }
}

// Warcraft scripts cannot queue orders, so a move issued together with the
// Call to Arms order would cancel the transformation. Forward workers are
// sent only once they have become Militia.
function sendNewMilitiaToEnemy(world: WorldState, context: TowerRushContext) {
  const destination = world.enemyMainGoldMine;

  if (!destination) {
    throw new Error("Tower rush: enemy main gold mine not found.");
  }

  for (const worker of context.forwardWorkers) {
    if (
      world.militia.includes(worker) &&
      !context.forwardWorkersSentToEnemy.includes(worker)
    ) {
      W3UnitApi.IssuePointOrder(
        worker,
        "move",
        W3UnitApi.GetUnitX(destination),
        W3UnitApi.GetUnitY(destination),
      );
      context.forwardWorkersSentToEnemy.push(worker);
    }
  }
}

// Idle Militia acquire and chase nearby enemies on their own, which would
// pull them away from the tower sites before they revert to Peasants.
function holdArrivedMilitia(world: WorldState, context: TowerRushContext) {
  const destination = world.enemyMainGoldMine;

  if (!destination) {
    throw new Error("Tower rush: enemy main gold mine not found.");
  }

  for (const worker of context.forwardWorkersSentToEnemy) {
    if (
      world.militia.includes(worker) &&
      !context.forwardWorkersHoldingPosition.includes(worker) &&
      distanceBetweenUnits(worker, destination) <= ARRIVAL_RADIUS
    ) {
      if (W3UnitApi.IssueImmediateOrder(worker, "holdposition")) {
        context.forwardWorkersHoldingPosition.push(worker);
      } else {
        debug("Tower rush: hold position order rejected.");
      }
    }
  }
}

function distanceBetweenUnits(a: W3UnitApi.unit, b: W3UnitApi.unit): number {
  const dx = W3UnitApi.GetUnitX(b) - W3UnitApi.GetUnitX(a);
  const dy = W3UnitApi.GetUnitY(b) - W3UnitApi.GetUnitY(a);
  return Math.sqrt(dx * dx + dy * dy);
}

function forwardWorkersHaveRevertedToPeasants(
  world: WorldState,
  context: TowerRushContext,
): boolean {
  const survivingForwardWorkers = context.forwardWorkers.filter(
    (worker) =>
      world.peasants.includes(worker) || world.militia.includes(worker),
  );

  return (
    survivingForwardWorkers.length > 0 &&
    survivingForwardWorkers.every(
      (worker) =>
        context.forwardWorkersSentToEnemy.includes(worker) &&
        world.peasants.includes(worker),
    )
  );
}
