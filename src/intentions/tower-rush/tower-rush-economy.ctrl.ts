import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import * as W3DestructableApi from "@lib/warcraft3-api/destructable";
import { BeliefContainer, Controller } from "@lib/bdi";
import { debug } from "../../debug";
import {
  CommonBeliefModel,
  CommonBeliefs,
} from "../../beliefs/common.beliefs";
import { HomeResource, TowerRushState } from "./tower-rush.state";
import { lumberDestructablesByPreference } from "./tower-rush.assessments";
import { GUARD_TOWER_UPGRADE_GOLD_COST } from "./establish-tower-position/upgrade-towers";
import {
  isWorkerSafe,
  WorkerSafety,
} from "../maintain-worker-safety/worker-safety.ctrl";

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
  { gold: 3, lumber: 4 },
  { gold: 4, lumber: 4 },
  { gold: 4, lumber: 5 },
];

/** The home economy that funds the tower rush. */
export class TowerRushEconomyController
  implements Controller<BeliefContainer>
{
  private readonly common: CommonBeliefModel;
  private readonly rush: TowerRushState;
  private readonly workerSafety: WorkerSafety;

  public constructor(
    common: CommonBeliefModel,
    rush: TowerRushState,
    workerSafety: WorkerSafety,
  ) {
    this.common = common;
    this.rush = rush;
    this.workerSafety = workerSafety;
  }

  public update(container: Readonly<BeliefContainer>) {
    const beliefs = container.get(this.common);
    const isSafe = (worker: W3UnitApi.unit) =>
      isWorkerSafe(this.workerSafety, worker, container);

    forgetDeadWorkers(beliefs, this.rush);
    assignNewHomeWorkers(beliefs, this.rush, isSafe);
    returnIdleWorkersToTheirResource(beliefs, this.rush, isSafe);
    maintainPeasantProduction(beliefs, this.rush);
  }
}

function forgetDeadWorkers(beliefs: Readonly<CommonBeliefs>, rush: TowerRushState) {
  rush.goldWorkers = rush.goldWorkers.filter((worker) =>
    beliefs.peasants.includes(worker),
  );
  rush.lumberWorkers = rush.lumberWorkers.filter((worker) =>
    beliefs.peasants.includes(worker),
  );
}

// A trained Peasant leaves the Town Hall already harvesting the resource it
// was rallied to. It is only ordered when the rally did not start it
// harvesting, e.g. when the rallied destructable is not a tree.
function assignNewHomeWorkers(
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
  isSafe: (worker: W3UnitApi.unit) => boolean,
) {
  for (const peasant of beliefs.peasants) {
    if (isAssignedWorker(peasant, rush)) {
      continue;
    }

    const resource =
      finishPeasantTraining(beliefs, rush) ?? nextWorkerResource(rush);

    if (resource === HomeResource.Gold) {
      rush.goldWorkers.push(peasant);
    } else {
      rush.lumberWorkers.push(peasant);
    }

    debug(
      `Tower rush: new Peasant joins ${HomeResource[resource]} (${describeWorkers(rush)}).`,
    );

    if (
      !beliefs.harvestingUnits.includes(peasant) &&
      isSafe(peasant) &&
      !orderHarvest(peasant, resource, beliefs)
    ) {
      debug(`Tower rush: ${HomeResource[resource]} harvest order rejected.`);
    }
  }
}

// The Town Hall has a single rally point, which a Peasant follows when it
// leaves training. It is pointed at the next Peasant's resource only once
// the previous one has left, so queueing does not redirect that one.
function finishPeasantTraining(
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
): HomeResource | undefined {
  const finished = rush.peasantsInTraining.shift();
  const next = rush.peasantsInTraining[0];

  if (finished !== undefined && next !== undefined) {
    rush.peasantTrainingStartedAt += PEASANT_TRAINING_SECONDS;

    if (beliefs.townHall) {
      setRally(beliefs.townHall, next, beliefs);
    }
  }

  return finished;
}

function nextWorkerResource(rush: TowerRushState): HomeResource {
  const targets = currentWorkerTargets(rush);

  return targets && plannedWorkers(rush).gold < targets.gold
    ? HomeResource.Gold
    : HomeResource.Lumber;
}

// The first stage not yet reached; undefined once all are.
function currentWorkerTargets(rush: TowerRushState): WorkerTargets | undefined {
  const planned = plannedWorkers(rush);

  return WORKER_TARGET_STAGES.find(
    (targets) => planned.gold < targets.gold || planned.lumber < targets.lumber,
  );
}

// Assigned workers together with the Peasants still in training.
function plannedWorkers(rush: TowerRushState): WorkerTargets {
  const inTraining = (resource: HomeResource) =>
    rush.peasantsInTraining.filter((planned) => planned === resource).length;

  return {
    gold: rush.goldWorkers.length + inTraining(HomeResource.Gold),
    lumber: rush.lumberWorkers.length + inTraining(HomeResource.Lumber),
  };
}

function describeWorkers(rush: TowerRushState): string {
  return `${rush.goldWorkers.length} gold, ${rush.lumberWorkers.length} lumber`;
}

function returnIdleWorkersToTheirResource(
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
  isSafe: (worker: W3UnitApi.unit) => boolean,
) {
  const isReturning = (worker: W3UnitApi.unit) =>
    beliefs.idleUnits.includes(worker) && isSafe(worker);

  for (const worker of rush.goldWorkers) {
    if (isReturning(worker)) {
      orderHarvestGold(worker, beliefs);
    }
  }

  for (const worker of rush.lumberWorkers) {
    if (isReturning(worker)) {
      orderHarvestPreferredTree(worker, beliefs);
    }
  }
}

// A training Town Hall still reports no current order, so production tracks
// its own Peasants in training to avoid queueing more than are needed.
function maintainPeasantProduction(
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
) {
  const { townHall } = beliefs;
  const homeWorkersMissing = currentWorkerTargets(rush) !== undefined;

  if (
    homeWorkersMissing &&
    canQueuePeasant(beliefs, rush) &&
    townHall &&
    beliefs.gold - goldReservedForUpgrades(beliefs, rush) >= PEASANT_GOLD_COST
  ) {
    trainPeasant(townHall, beliefs, rush);
  }
}

// The next Peasant is queued shortly before the current one finishes, so the
// Town Hall does not stand idle until the next update notices, while the
// gold is not tied up in the queue for long. Warcraft exposes no training
// progress, so it is estimated from the fixed training time.
function canQueuePeasant(
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
): boolean {
  const queued = rush.peasantsInTraining.length;
  const currentProgress =
    (beliefs.time - rush.peasantTrainingStartedAt) / PEASANT_TRAINING_SECONDS;

  return (
    queued === 0 ||
    (queued === 1 && currentProgress >= QUEUE_NEXT_PEASANT_AT_PROGRESS)
  );
}

// A Guard Tower upgrade is paid when it starts, so an upgrading tower no
// longer needs reserved gold.
function goldReservedForUpgrades(
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
): number {
  if (!rush.reservingGoldForUpgrades) {
    return 0;
  }

  const towersAwaitingUpgrade = beliefs.scoutTowers.filter(
    (tower) => !beliefs.buildingsUpgrading.includes(tower),
  );

  return towersAwaitingUpgrade.length * GUARD_TOWER_UPGRADE_GOLD_COST;
}

export function trainPeasant(
  townHall: W3UnitApi.unit,
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
) {
  const resource = nextWorkerResource(rush);
  const startsNow = rush.peasantsInTraining.length === 0;

  if (startsNow) {
    setRally(townHall, resource, beliefs);
  }

  if (W3UnitApi.IssueImmediateOrderById(townHall, W3HumanApi.Unit.PEASANT)) {
    if (startsNow) {
      rush.peasantTrainingStartedAt = beliefs.time;
    }

    rush.peasantsInTraining.push(resource);
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
  beliefs: Readonly<CommonBeliefs>,
) {
  const target = rallyTarget(townHall, resource, beliefs);

  if (!W3UnitApi.IssueTargetOrder(townHall, "setrally", target)) {
    debug(`Tower rush: rally to ${HomeResource[resource]} rejected.`);
  }
}

// The rallied destructable is not checked to be a tree; a Peasant rallied to
// anything else does not start harvesting and is then ordered to a real tree.
// A rallied Peasant leaves from the Town Hall, so the tree is chosen as seen
// from there.
function rallyTarget(
  townHall: W3UnitApi.unit,
  resource: HomeResource,
  beliefs: Readonly<CommonBeliefs>,
): W3UnitApi.unit | W3DestructableApi.destructable {
  if (resource === HomeResource.Gold) {
    if (!beliefs.homeGoldMine) {
      throw new Error("Tower rush: home gold mine not found.");
    }

    return beliefs.homeGoldMine.unit;
  }

  const nearest = lumberDestructablesByPreference(beliefs, townHall)[0];

  if (!nearest) {
    throw new Error("Tower rush: no destructable near home to rally to.");
  }

  return nearest.destructable;
}

function isAssignedWorker(peasant: W3UnitApi.unit, rush: TowerRushState): boolean {
  return (
    rush.forwardWorkers.includes(peasant) ||
    rush.goldWorkers.includes(peasant) ||
    rush.lumberWorkers.includes(peasant)
  );
}

function orderHarvest(
  worker: W3UnitApi.unit,
  resource: HomeResource,
  beliefs: Readonly<CommonBeliefs>,
): boolean {
  return resource === HomeResource.Gold
    ? orderHarvestGold(worker, beliefs)
    : orderHarvestPreferredTree(worker, beliefs);
}

function orderHarvestGold(
  worker: W3UnitApi.unit,
  beliefs: Readonly<CommonBeliefs>,
): boolean {
  if (!beliefs.homeGoldMine) {
    throw new Error("Tower rush: home gold mine not found.");
  }

  return W3UnitApi.IssueTargetOrder(worker, "harvest", beliefs.homeGoldMine.unit);
}

// Beliefs cannot tell trees apart from other destructables, so the harvest
// order itself is used as the test: Warcraft rejects it for non-trees.
function orderHarvestPreferredTree(
  worker: W3UnitApi.unit,
  beliefs: Readonly<CommonBeliefs>,
): boolean {
  for (const { destructable } of lumberDestructablesByPreference(
    beliefs,
    worker,
  )) {
    if (W3UnitApi.IssueTargetOrder(worker, "harvest", destructable)) {
      return true;
    }
  }

  debug("Tower rush: no nearby tree accepted a harvest order.");

  return false;
}
