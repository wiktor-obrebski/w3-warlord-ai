import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import { debug } from "../../debug";
import { WorldState } from "../../perception/world-state";
import { TowerRushContext } from "./tower-rush-context";

const PEASANT_GOLD_COST = 75;
const GOLD_WORKER_TARGET = 5;
const LUMBER_WORKER_TARGET = 3;

export function maintainHomeEconomy(
  world: WorldState,
  context: TowerRushContext,
) {
  forgetDeadWorkers(world, context);
  assignNewHomeWorkers(world, context);
  returnIdleWorkersToTheirResource(world, context);
  maintainPeasantProduction(world, context);
}

function forgetDeadWorkers(world: WorldState, context: TowerRushContext) {
  context.goldWorkers = context.goldWorkers.filter((worker) =>
    world.peasants.includes(worker),
  );
  context.lumberWorkers = context.lumberWorkers.filter((worker) =>
    world.peasants.includes(worker),
  );
}

// New Peasants are assigned on first sight rather than when idle, because
// Warcraft can start them harvesting on its own (e.g. via the Town Hall rally
// point), which would keep them on gold beyond the target.
function assignNewHomeWorkers(world: WorldState, context: TowerRushContext) {
  for (const peasant of world.peasants) {
    if (isAssignedWorker(peasant, context)) {
      continue;
    }

    context.peasantInTraining = false;

    if (context.goldWorkers.length < GOLD_WORKER_TARGET) {
      if (orderHarvestGold(peasant, world)) {
        context.goldWorkers.push(peasant);
        debug(`Tower rush: Peasant sent to gold (${context.goldWorkers.length}/${GOLD_WORKER_TARGET}).`);
      } else {
        debug("Tower rush: gold harvest order rejected.");
      }
    } else if (orderHarvestNearestTree(peasant, world)) {
      context.lumberWorkers.push(peasant);
      debug(`Tower rush: Peasant sent to lumber (${context.lumberWorkers.length}/${LUMBER_WORKER_TARGET}).`);
    }
  }
}

function returnIdleWorkersToTheirResource(
  world: WorldState,
  context: TowerRushContext,
) {
  for (const worker of context.goldWorkers) {
    if (world.idleUnits.includes(worker)) {
      orderHarvestGold(worker, world);
    }
  }

  for (const worker of context.lumberWorkers) {
    if (world.idleUnits.includes(worker)) {
      orderHarvestNearestTree(worker, world);
    }
  }
}

// A training Town Hall still reports no current order, so production tracks
// its own in-flight Peasant to avoid queueing more than are needed.
function maintainPeasantProduction(
  world: WorldState,
  context: TowerRushContext,
) {
  const { townHall } = world;
  const homeWorkersMissing =
    context.goldWorkers.length < GOLD_WORKER_TARGET ||
    context.lumberWorkers.length < LUMBER_WORKER_TARGET;

  if (
    homeWorkersMissing &&
    !context.peasantInTraining &&
    townHall &&
    world.gold >= PEASANT_GOLD_COST
  ) {
    context.peasantInTraining = W3UnitApi.IssueImmediateOrderById(
      townHall,
      W3HumanApi.Unit.PEASANT,
    );
    debug("Tower rush: Peasant training ordered.");
  }
}

function isAssignedWorker(
  peasant: W3UnitApi.unit,
  context: TowerRushContext,
): boolean {
  return (
    context.forwardWorkers.includes(peasant) ||
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
