import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import * as W3DestructableApi from "@lib/warcraft3-api/destructable";
import { debug } from "../../debug";
import { WorldState } from "../../perception/world-state";
import { HomeResource, TowerRushContext } from "./tower-rush-context";
import { GUARD_TOWER_UPGRADE_GOLD_COST } from "./phases/upgrading-towers";

const PEASANT_GOLD_COST = 75;
// Warcraft's listed Peasant training time; not verified in-game.
const PEASANT_TRAINING_SECONDS = 15;
const QUEUE_NEXT_PEASANT_AT_PROGRESS = 0.9;

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
  moveEmptyLumberWorkersToMill(world, context);
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
  context.lumberWorkersAtMill = context.lumberWorkersAtMill.filter((worker) =>
    world.peasants.includes(worker),
  );
}

// Lumber workers start out by the trees nearest the Town Hall. Once the
// Lumber Mill is finished, each one is sent to the trees by the mill right
// after it has dropped off its lumber, so no carried lumber is lost.
// Warcraft exposes no carried amount, so a worker that stops returning
// resources is taken to have just dropped off its load.
function moveEmptyLumberWorkersToMill(
  world: WorldState,
  context: TowerRushContext,
) {
  const wasReturning = context.lumberWorkersReturning;
  context.lumberWorkersReturning = context.lumberWorkers.filter((worker) =>
    world.returningResourcesUnits.includes(worker),
  );

  if (!completedLumberMill(world)) {
    return;
  }

  for (const worker of context.lumberWorkers) {
    const justDroppedOff =
      wasReturning.includes(worker) &&
      !world.returningResourcesUnits.includes(worker);

    if (justDroppedOff && !context.lumberWorkersAtMill.includes(worker)) {
      if (orderHarvestPreferredTree(worker, world, context)) {
        debug("Tower rush: lumber worker moves to the trees by the Lumber Mill.");
      }
    }
  }
}

function completedLumberMill(world: WorldState): W3UnitApi.unit | undefined {
  return world.lumberMills.find(
    (mill) => !world.buildingsUnderConstruction.includes(mill),
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
      finishPeasantTraining(world, context) ?? nextWorkerResource(context);

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
      !orderHarvest(peasant, resource, world, context)
    ) {
      debug(`Tower rush: ${HomeResource[resource]} harvest order rejected.`);
    }
  }
}

// The Town Hall has a single rally point, which a Peasant follows when it
// leaves training. It is pointed at the next Peasant's resource only once
// the previous one has left, so queueing does not redirect that one.
function finishPeasantTraining(
  world: WorldState,
  context: TowerRushContext,
): HomeResource | undefined {
  const finished = context.peasantsInTraining.shift();
  const next = context.peasantsInTraining[0];

  if (finished !== undefined && next !== undefined) {
    context.peasantTrainingStartedAt += PEASANT_TRAINING_SECONDS;

    if (world.townHall) {
      setRally(world.townHall, next, world);
    }
  }

  return finished;
}

function nextWorkerResource(context: TowerRushContext): HomeResource {
  const targets = currentWorkerTargets(context);

  return targets && plannedWorkers(context).gold < targets.gold
    ? HomeResource.Gold
    : HomeResource.Lumber;
}

// The first stage not yet reached; undefined once all are.
function currentWorkerTargets(
  context: TowerRushContext,
): WorkerTargets | undefined {
  const planned = plannedWorkers(context);

  return WORKER_TARGET_STAGES.find(
    (targets) => planned.gold < targets.gold || planned.lumber < targets.lumber,
  );
}

// Assigned workers together with the Peasants still in training.
function plannedWorkers(context: TowerRushContext): WorkerTargets {
  const inTraining = (resource: HomeResource) =>
    context.peasantsInTraining.filter((planned) => planned === resource).length;

  return {
    gold: context.goldWorkers.length + inTraining(HomeResource.Gold),
    lumber: context.lumberWorkers.length + inTraining(HomeResource.Lumber),
  };
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
      orderHarvestPreferredTree(worker, world, context);
    }
  }
}

// A training Town Hall still reports no current order, so production tracks
// its own Peasants in training to avoid queueing more than are needed.
function maintainPeasantProduction(
  world: WorldState,
  context: TowerRushContext,
) {
  const { townHall } = world;
  const homeWorkersMissing = currentWorkerTargets(context) !== undefined;

  if (
    homeWorkersMissing &&
    canQueuePeasant(world, context) &&
    townHall &&
    world.gold - goldReservedForUpgrades(world, context) >= PEASANT_GOLD_COST
  ) {
    trainPeasant(townHall, world, context);
  }
}

// The next Peasant is queued shortly before the current one finishes, so the
// Town Hall does not stand idle until the next update notices, while the
// gold is not tied up in the queue for long. Warcraft exposes no training
// progress, so it is estimated from the fixed training time.
function canQueuePeasant(world: WorldState, context: TowerRushContext): boolean {
  const queued = context.peasantsInTraining.length;
  const currentProgress =
    (world.time - context.peasantTrainingStartedAt) / PEASANT_TRAINING_SECONDS;

  return (
    queued === 0 ||
    (queued === 1 && currentProgress >= QUEUE_NEXT_PEASANT_AT_PROGRESS)
  );
}

// A Guard Tower upgrade is paid when it starts, so an upgrading tower no
// longer needs reserved gold.
function goldReservedForUpgrades(
  world: WorldState,
  context: TowerRushContext,
): number {
  if (!context.reservingGoldForUpgrades) {
    return 0;
  }

  const towersAwaitingUpgrade = world.scoutTowers.filter(
    (tower) => !world.buildingsUpgrading.includes(tower),
  );

  return towersAwaitingUpgrade.length * GUARD_TOWER_UPGRADE_GOLD_COST;
}

export function trainPeasant(
  townHall: W3UnitApi.unit,
  world: WorldState,
  context: TowerRushContext,
) {
  const resource = nextWorkerResource(context);
  const startsNow = context.peasantsInTraining.length === 0;

  if (startsNow) {
    setRally(townHall, resource, world);
  }

  if (W3UnitApi.IssueImmediateOrderById(townHall, W3HumanApi.Unit.PEASANT)) {
    if (startsNow) {
      context.peasantTrainingStartedAt = world.time;
    }

    context.peasantsInTraining.push(resource);
    debug(
      `Tower rush: Peasant training ${startsNow ? "ordered" : "queued"} for ${HomeResource[resource]}.`,
    );
  } else {
    debug("Tower rush: Peasant training order rejected.");
  }
}

function setRally(
  townHall: W3UnitApi.unit,
  resource: HomeResource,
  world: WorldState,
) {
  if (!W3UnitApi.IssueTargetOrder(townHall, "setrally", rallyTarget(resource, world))) {
    debug(`Tower rush: rally to ${HomeResource[resource]} rejected.`);
  }
}

// The rallied destructable is not checked to be a tree; a Peasant rallied to
// anything else does not start harvesting and is then ordered to a real tree.
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

  const nearest = lumberDestructablesByPreference(world)[0];

  if (!nearest) {
    throw new Error("Tower rush: no destructable near home to rally to.");
  }

  return nearest;
}

// Nearest the finished Lumber Mill, where lumber is returned; until it is
// finished, nearest home, where the Town Hall takes the lumber. Rallies and
// harvest orders share this order so a new Peasant ordered to harvest is not
// turned away from the tree it was rallied to.
function lumberDestructablesByPreference(
  world: WorldState,
): W3DestructableApi.destructable[] {
  const mill = completedLumberMill(world);

  if (!mill) {
    return world.destructablesNearHomeByDistance;
  }

  const millX = W3UnitApi.GetUnitX(mill);
  const millY = W3UnitApi.GetUnitY(mill);
  const distanceSquaredToMill = (
    destructable: W3DestructableApi.destructable,
  ) => {
    const dx = W3DestructableApi.GetDestructableX(destructable) - millX;
    const dy = W3DestructableApi.GetDestructableY(destructable) - millY;
    return dx * dx + dy * dy;
  };

  return world.destructablesNearHomeByDistance
    .map((destructable) => ({
      destructable,
      distanceSquared: distanceSquaredToMill(destructable),
    }))
    .sort((a, b) => a.distanceSquared - b.distanceSquared)
    .map((entry) => entry.destructable);
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
  context: TowerRushContext,
): boolean {
  return resource === HomeResource.Gold
    ? orderHarvestGold(worker, world)
    : orderHarvestPreferredTree(worker, world, context);
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
function orderHarvestPreferredTree(
  worker: W3UnitApi.unit,
  world: WorldState,
  context: TowerRushContext,
): boolean {
  for (const destructable of lumberDestructablesByPreference(world)) {
    if (W3UnitApi.IssueTargetOrder(worker, "harvest", destructable)) {
      if (
        completedLumberMill(world) &&
        !context.lumberWorkersAtMill.includes(worker)
      ) {
        context.lumberWorkersAtMill.push(worker);
      }

      return true;
    }
  }

  debug("Tower rush: no nearby tree accepted a harvest order.");

  return false;
}
