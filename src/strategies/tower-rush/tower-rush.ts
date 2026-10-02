import { debug } from "../../debug";
import { WorldState } from "../../perception/world-state";
import { TowerRushContext, TowerRushPhase } from "./tower-rush-context";
import { updateStart } from "./phases/start";
import { updateMovingToEnemy } from "./phases/moving-to-enemy";

export function updateTowerRush(world: WorldState, context: TowerRushContext) {
  const previousPhase = context.phase;

  switch (context.phase) {
    case TowerRushPhase.Start:
      updateStart(world, context);
      break;

    case TowerRushPhase.MovingToEnemy:
      updateMovingToEnemy(world, context);
      break;

    case TowerRushPhase.BuildingTowers:
      break;
  }

  if (context.phase !== previousPhase) {
    debug(
      `Tower rush phase: ${TowerRushPhase[previousPhase]} -> ${TowerRushPhase[context.phase]}`,
    );
  }
}
