import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { WorldState } from "../../../perception/world-state";
import { TowerRushContext, TowerRushPhase } from "../tower-rush-context";

export function updateMovingToEnemy(
  world: WorldState,
  context: TowerRushContext,
) {
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
