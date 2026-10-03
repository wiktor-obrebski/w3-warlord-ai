import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3MathApi from "@lib/warcraft3-api/math";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import { debug } from "../../../debug";
import { Point, WorldState } from "../../../perception/world-state";
import { TowerRushContext, TowerRushPhase } from "../tower-rush-context";

const STARTING_PEASANT_COUNT = 5;
const FORWARD_WORKER_COUNT = 3;
const LUMBER_MILL_PLACEMENT_ATTEMPTS = 20;

export function updateStart(world: WorldState, context: TowerRushContext) {
  const { townHall, enemyMainGoldMine, homeGoldMine } = world;

  if (!townHall) {
    throw new Error("Tower rush start: Town Hall not found.");
  }

  if (!enemyMainGoldMine) {
    throw new Error("Tower rush start: enemy main gold mine not found.");
  }

  if (!homeGoldMine) {
    throw new Error("Tower rush start: home gold mine not found.");
  }

  const [lumberMillBuilder, homeWorker] =
    world.peasants.slice(FORWARD_WORKER_COUNT);

  if (!lumberMillBuilder || !homeWorker) {
    throw new Error(
      `Tower rush start: expected ${STARTING_PEASANT_COUNT} Peasants, found ${world.peasants.length}.`,
    );
  }

  context.forwardWorkers = world.peasants.slice(0, FORWARD_WORKER_COUNT);
  context.goldWorkers = [homeWorker];
  context.lumberWorkers = [lumberMillBuilder];

  for (const worker of context.forwardWorkers) {
    W3UnitApi.IssueImmediateOrder(worker, "militia");
  }

  orderLumberMill(lumberMillBuilder, world.ownStartPosition);
  W3UnitApi.IssueTargetOrder(homeWorker, "harvest", homeGoldMine);
  context.peasantInTraining = W3UnitApi.IssueImmediateOrderById(
    townHall,
    W3HumanApi.Unit.PEASANT,
  );

  context.phase = TowerRushPhase.MovingToEnemy;
}

function orderLumberMill(builder: W3UnitApi.unit, base: Point) {
  for (let attempt = 0; attempt < LUMBER_MILL_PLACEMENT_ATTEMPTS; attempt++) {
    const angle = W3MathApi.GetRandomReal(0, Math.PI * 2);
    const distance = W3MathApi.GetRandomReal(500, 900);

    const accepted = W3UnitApi.IssueBuildOrderById(
      builder,
      W3HumanApi.Building.LUMBER_MILL,
      base.x + Math.cos(angle) * distance,
      base.y + Math.sin(angle) * distance,
    );

    if (accepted) {
      return;
    }
  }

  debug("Tower rush start: all Lumber Mill locations rejected.");
}
