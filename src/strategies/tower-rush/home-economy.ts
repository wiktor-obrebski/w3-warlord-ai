import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import * as W3DestructableApi from "@lib/warcraft3-api/destructable";
import { debug } from "../../debug";
import { WorldState } from "../../perception/world-state";
import { HomeResource, TowerRushContext } from "./tower-rush-context";

const PEASANT_GOLD_COST = 75;

interface WorkerTargets {
  gold: number;
  lumber: number;
}

// Lumber counts include the Lumber Mill builder, which is a lumber worker
// from the start but only harvests once the mill is finished. Lumber workers
// come in early so Guard Tower upgrades are not starved of lumber.
const WORKER_TARGET_STAGES: WorkerTargets[] = [
  { gold: 2, lumber: 1 },
  { gold: 2, lumber: 2 },
  { gold: 2, lumber: 3 },
  { gold: 3, lumber: 3 },
  { gold: 4, lumber: 3 },
  { gold: 5, lumber: 3 },
];

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

// A trained Peasant leaves the Town Hall already harvesting the resource it
// was rallied to. It is only ordered when the rally did not start it
// harvesting, e.g. when the rallied destructable is not a tree.
function assignNewHomeWorkers(world: WorldState, context: TowerRushContext) {
  for (const peasant of world.peasants) {
    if (isAssignedWorker(peasant, context)) {
      continue;
    }

    const resource =
      context.trainingPeasantResource ?? nextWorkerResource(context);
    context.trainingPeasantResource = undefined;

    if (resource === HomeResource.Gold) {
      context.goldWorkers.push(peasant);
    } else {
      context.lumberWorkers.push(peasant);
    }

    debug(
      `Tower rush: new Peasant joins ${HomeResource[resource]} (${describeWorkers(context)}).`,
    );

    if (
      !world.harvestingUnits.includes(peasant) &&
      !orderHarvest(peasant, resource, world)
    ) {
      debug(`Tower rush: ${HomeResource[resource]} harvest order rejected.`);
    }
  }
}

function nextWorkerResource(context: TowerRushContext): HomeResource {
  const targets = currentWorkerTargets(context);

  return targets && context.goldWorkers.length < targets.gold
    ? HomeResource.Gold
    : HomeResource.Lumber;
}

// The first stage not yet reached; undefined once all are.
function currentWorkerTargets(
  context: TowerRushContext,
): WorkerTargets | undefined {
  return WORKER_TARGET_STAGES.find(
    (targets) =>
      context.goldWorkers.length < targets.gold ||
      context.lumberWorkers.length < targets.lumber,
  );
}

function describeWorkers(context: TowerRushContext): string {
  return `${context.goldWorkers.length} gold, ${context.lumberWorkers.length} lumber`;
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
  const homeWorkersMissing = currentWorkerTargets(context) !== undefined;

  if (
    homeWorkersMissing &&
    context.trainingPeasantResource === undefined &&
    townHall &&
    world.gold >= PEASANT_GOLD_COST
  ) {
    trainPeasant(townHall, world, context);
  }
}

export function trainPeasant(
  townHall: W3UnitApi.unit,
  world: WorldState,
  context: TowerRushContext,
) {
  const resource = nextWorkerResource(context);

  if (!W3UnitApi.IssueTargetOrder(townHall, "setrally", rallyTarget(resource, world))) {
    debug(`Tower rush: rally to ${HomeResource[resource]} rejected.`);
  }

  if (W3UnitApi.IssueImmediateOrderById(townHall, W3HumanApi.Unit.PEASANT)) {
    context.trainingPeasantResource = resource;
    debug(`Tower rush: Peasant training ordered for ${HomeResource[resource]}.`);
  } else {
    debug("Tower rush: Peasant training order rejected.");
  }
}

// The nearest destructable is used for lumber without checking that it is a
// tree; a Peasant rallied to anything else does not start harvesting and is
// then ordered to a real tree.
function rallyTarget(
  resource: HomeResource,
  world: WorldState,
): W3UnitApi.unit | W3DestructableApi.destructable {
  if (resource === HomeResource.Gold) {
    if (!world.homeGoldMine) {
      throw new Error("Tower rush: home gold mine not found.");
    }

    return world.homeGoldMine;
  }

  const nearest = world.destructablesNearHomeByDistance[0];

  if (!nearest) {
    throw new Error("Tower rush: no destructable near home to rally to.");
  }

  return nearest;
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

function orderHarvest(
  worker: W3UnitApi.unit,
  resource: HomeResource,
  world: WorldState,
): boolean {
  return resource === HomeResource.Gold
    ? orderHarvestGold(worker, world)
    : orderHarvestNearestTree(worker, world);
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
