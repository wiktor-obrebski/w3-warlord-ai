import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3MathApi from "@lib/warcraft3-api/math";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import { debug } from "../../../debug";
import { Point, WorldState } from "../../../perception/world-state";
import { TowerRushContext, TowerRushPhase } from "../tower-rush-context";
import { trainPeasant } from "../home-economy";

const STARTING_PEASANT_COUNT = 5;
const FORWARD_WORKER_COUNT = 3;
// Town Hall and Lumber Mill footprints are assumed, not verified, to be about
// 512 and 384 wide, so the closest non-overlapping centers are about 450
// apart along an axis; the search starts a little closer to cover diagonals
// of the build grid.
const MIN_LUMBER_MILL_DISTANCE = 384;
const MAX_LUMBER_MILL_DISTANCE = 1200;
const DISTANCE_INCREASE = 32;
const REJECTIONS_PER_DISTANCE_INCREASE = 10;

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

  orderLumberMill(lumberMillBuilder, townHall, homeGoldMine);
  W3UnitApi.IssueTargetOrder(homeWorker, "harvest", homeGoldMine);
  trainPeasant(townHall, world, context);

  context.phase = TowerRushPhase.MovingToEnemy;
}

// The search starts just outside the Town Hall and widens on rejection;
// IssueBuildOrderById rejects blocked spots, so the order itself is the
// placement test. Only the half facing away from the gold mine is searched
// so the mill never stands in the way of gold workers.
function orderLumberMill(
  builder: W3UnitApi.unit,
  townHall: W3UnitApi.unit,
  mine: W3UnitApi.unit,
) {
  const hall = positionOf(townHall);
  const minePosition = positionOf(mine);
  const angleToMine = Math.atan2(
    minePosition.y - hall.y,
    minePosition.x - hall.x,
  );
  let distance = MIN_LUMBER_MILL_DISTANCE;
  let rejections = 0;

  while (distance <= MAX_LUMBER_MILL_DISTANCE) {
    const angle =
      angleToMine + Math.PI / 2 + W3MathApi.GetRandomReal(0, Math.PI);
    const accepted = W3UnitApi.IssueBuildOrderById(
      builder,
      W3HumanApi.Building.LUMBER_MILL,
      hall.x + Math.cos(angle) * distance,
      hall.y + Math.sin(angle) * distance,
    );

    if (accepted) {
      debug(
        `Tower rush start: Lumber Mill ordered ${distance} from the Town Hall after ${rejections} rejections.`,
      );
      return;
    }

    rejections++;

    if (rejections % REJECTIONS_PER_DISTANCE_INCREASE === 0) {
      distance += DISTANCE_INCREASE;
    }
  }

  debug("Tower rush start: all Lumber Mill locations rejected.");
}

function positionOf(unit: W3UnitApi.unit): Point {
  return { x: W3UnitApi.GetUnitX(unit), y: W3UnitApi.GetUnitY(unit) };
}
