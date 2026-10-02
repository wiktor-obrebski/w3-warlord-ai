import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import { debug } from "../../../debug";
import { WorldState } from "../../../perception/world-state";
import { TowerRushContext, TowerRushPhase } from "../tower-rush-context";

const PEASANT_GOLD_COST = 75;
const GOLD_WORKER_TARGET = 5;

export function updateMovingToEnemy(
  world: WorldState,
  context: TowerRushContext,
) {
  sendNewMilitiaToEnemy(world, context);
  maintainPeasantProduction(world);
  sendIdleLumberMillBuilderToLumber(world, context);
  assignNewHomeWorkers(world, context);

  if (forwardWorkersHaveRevertedToPeasants(world, context)) {
    context.phase = TowerRushPhase.BuildingTowers;
  }
}

// Warcraft scripts cannot queue orders, so a move issued together with the
// Call to Arms order would cancel the transformation. Forward workers are
// sent only once they have become Militia.
function sendNewMilitiaToEnemy(world: WorldState, context: TowerRushContext) {
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

function maintainPeasantProduction(world: WorldState) {
  const { townHall } = world;

  if (
    townHall &&
    world.idleUnits.includes(townHall) &&
    world.gold >= PEASANT_GOLD_COST
  ) {
    W3UnitApi.IssueImmediateOrderById(townHall, W3HumanApi.Unit.PEASANT);
  }
}

function sendIdleLumberMillBuilderToLumber(
  world: WorldState,
  context: TowerRushContext,
) {
  const builder = context.lumberMillBuilder;

  if (
    builder &&
    world.idleUnits.includes(builder) &&
    !context.lumberWorkers.includes(builder) &&
    orderHarvestNearestTree(builder, world)
  ) {
    context.lumberWorkers.push(builder);
  }
}

// New Peasants are assigned on first sight rather than when idle, because
// Warcraft can start them harvesting on its own (e.g. via the Town Hall rally
// point), which would keep them on gold beyond the target.
function assignNewHomeWorkers(world: WorldState, context: TowerRushContext) {
  for (const peasant of world.peasants) {
    if (isAssignedWorker(peasant, context)) {
      continue;
    }

    if (context.goldWorkers.length < GOLD_WORKER_TARGET) {
      if (orderHarvestGold(peasant, world)) {
        context.goldWorkers.push(peasant);
        debug(`Tower rush: Peasant sent to gold (${context.goldWorkers.length}/${GOLD_WORKER_TARGET}).`);
      } else {
        debug("Tower rush: gold harvest order rejected.");
      }
    } else if (orderHarvestNearestTree(peasant, world)) {
      context.lumberWorkers.push(peasant);
      debug(`Tower rush: Peasant sent to lumber (${context.lumberWorkers.length}).`);
    }
  }
}

function isAssignedWorker(
  peasant: W3UnitApi.unit,
  context: TowerRushContext,
): boolean {
  return (
    context.forwardWorkers.includes(peasant) ||
    peasant === context.lumberMillBuilder ||
    context.goldWorkers.includes(peasant) ||
    context.lumberWorkers.includes(peasant)
  );
}

function orderHarvestGold(
  worker: W3UnitApi.unit,
  world: WorldState,
): boolean {
  if (!world.homeGoldMine) {
    throw new Error("Tower rush: home gold mine not found.");
  }

  return W3UnitApi.IssueTargetOrder(worker, "harvest", world.homeGoldMine);
}

// Perception cannot tell trees apart from other destructables, so the harvest
// order itself is used as the test: Warcraft rejects it for non-trees.
function orderHarvestNearestTree(
  worker: W3UnitApi.unit,
  world: WorldState,
): boolean {
  for (const destructable of world.destructablesNearHomeByDistance) {
    if (W3UnitApi.IssueTargetOrder(worker, "harvest", destructable)) {
      return true;
    }
  }

  debug("Tower rush: no nearby tree accepted a harvest order.");

  return false;
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
