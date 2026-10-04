import { debug } from "../../debug";
import { WorldState } from "../../perception/world-state";
import { TowerRushContext, TowerRushPhase } from "./tower-rush-context";
import { updateStart } from "./phases/start";
import { updateMovingToEnemy } from "./phases/moving-to-enemy";
import { updateBuildingTowers } from "./phases/building-towers";
import { updateUpgradingTowers } from "./phases/upgrading-towers";
import { updateHoldingPosition } from "./phases/holding-position";
import { maintainHomeEconomy } from "./home-economy";
import { forgetHidingOfUnsafeWorkers } from "./forward-workers";
import { WorkerSafety } from "../../capabilities/worker-safety/worker-safety";

export function updateTowerRush(
  world: WorldState,
  context: TowerRushContext,
  workerSafety: WorkerSafety,
) {
  const previousPhase = context.phase;

  forgetHidingOfUnsafeWorkers(world, context, workerSafety);

  // The economy works from this tick's perception, which predates the orders
  // Start issues; running it on that tick would override them.
  if (previousPhase !== TowerRushPhase.Start) {
    maintainHomeEconomy(world, context, workerSafety);
  }

  switch (context.phase) {
    case TowerRushPhase.Start:
      updateStart(world, context);
      break;

    case TowerRushPhase.MovingToEnemy:
      updateMovingToEnemy(world, context);
      break;

    case TowerRushPhase.BuildingTowers:
      updateBuildingTowers(world, context, workerSafety);
      break;

    case TowerRushPhase.UpgradingTowers:
      updateUpgradingTowers(world, context, workerSafety);
      break;

    case TowerRushPhase.HoldingPosition:
      updateHoldingPosition(world, context, workerSafety);
      break;
  }

  if (context.phase !== previousPhase) {
    debug(
      `Tower rush phase: ${TowerRushPhase[previousPhase]} -> ${TowerRushPhase[context.phase]}`,
    );
  }
}
