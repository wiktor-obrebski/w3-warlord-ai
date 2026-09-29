import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { WorldState } from "../../../perception/world-state";
import { TowerRushContext } from "../tower-rush-context";

// Warcraft scripts cannot queue orders, so a move issued together with the
// Call to Arms order would cancel the transformation. Forward workers are
// sent only once they have become Militia.
export function updateMovingToEnemy(
  world: WorldState,
  context: TowerRushContext,
) {
  const destination = context.enemyMainPosition;

  if (!destination) {
    throw new Error("Tower rush: enemy main position is not known.");
  }

  for (const worker of context.forwardWorkers) {
    if (
      world.militia.includes(worker) &&
      !context.forwardWorkersSentToEnemy.includes(worker)
    ) {
      W3UnitApi.IssuePointOrder(worker, "move", destination.x, destination.y);
      context.forwardWorkersSentToEnemy.push(worker);
    }
  }
}
