import * as W3UnitApi from '@lib/warcraft3-api/unit';
import * as W3HumanApi from '@lib/warcraft3-api/human';
import * as W3DestructableApi from '@lib/warcraft3-api/destructable';
import { debug } from '../../debug';
import { ActorControl, NORMAL_REQUEST } from '../../actor';
import {
  ProvidedComponent,
  WarlordBeliefs,
  WarlordController,
} from '../../execution';
import { CommonBeliefs } from '../../beliefs/common.beliefs';
import { HOME_RESOURCE, TowerRushState } from './tower-rush.state';
import { lumberDestructablesByPreference } from './tower-rush.assessments';
import { GUARD_TOWER_UPGRADE_GOLD_COST } from './establish-tower-position/upgrade-towers';

export { provideTowerRushEconomyController, trainPeasant };

const PeasantGoldCost = 75;
// Warcraft's listed Peasant training time; not verified in-game.
const PeasantTrainingSeconds = 15;
const QueueNextPeasantAtProgress = 0.9;

interface WorkerTargets {
  gold: number;
  lumber: number;
}

// Lumber counts include the Lumber Mill builder, which is a lumber worker
// from the start but only harvests once the mill is finished. Lumber workers
// come in early so Guard Tower upgrades are not starved of lumber.
const WorkerTargetStages: WorkerTargets[] = [
  { gold: 2, lumber: 1 },
  { gold: 2, lumber: 2 },
  { gold: 2, lumber: 3 },
  { gold: 3, lumber: 3 },
  { gold: 3, lumber: 4 },
  { gold: 4, lumber: 4 },
  { gold: 4, lumber: 5 },
];

/**
 * The home economy that funds the tower rush. The Town Hall and every home
 * worker are requested on each update, so they stay controlled for as long as
 * the economy runs; one taken over meanwhile is left alone.
 */
class TowerRushEconomyController implements WarlordController {
  private readonly rush: TowerRushState;

  public constructor({ rush }: { rush: TowerRushState }) {
    this.rush = rush;
  }

  public update({
    beliefs: { common: beliefs },
    control,
  }: {
    beliefs: WarlordBeliefs;
    control: ActorControl;
  }) {
    const townHall =
      beliefs.townHall &&
      control.request({
        actor: beliefs.townHall,
        request: NORMAL_REQUEST,
      })
        ? beliefs.townHall
        : undefined;

    forgetDeadWorkers({ beliefs, rush: this.rush });
    assignNewHomeWorkers({
      beliefs,
      rush: this.rush,
      townHall,
      control,
    });
    returnIdleWorkersToTheirResource({
      beliefs,
      rush: this.rush,
      control,
    });
    maintainPeasantProduction({
      beliefs,
      rush: this.rush,
      townHall,
    });
  }
}

function provideTowerRushEconomyController({
  rush,
}: {
  rush: TowerRushState;
}): ProvidedComponent<WarlordController> {
  return {
    value: new TowerRushEconomyController({ rush }),
    children: [],
  };
}

function forgetDeadWorkers({
  beliefs,
  rush,
}: {
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
}) {
  rush.goldWorkers = rush.goldWorkers.filter((worker) =>
    beliefs.peasants.includes(worker)
  );
  rush.lumberWorkers = rush.lumberWorkers.filter((worker) =>
    beliefs.peasants.includes(worker)
  );
}

// A trained Peasant leaves the Town Hall already harvesting the resource it
// was rallied to. It is only ordered when the rally did not start it
// harvesting, e.g. when the rallied destructable is not a tree.
function assignNewHomeWorkers({
  beliefs,
  rush,
  townHall,
  control,
}: {
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
  townHall: W3UnitApi.unit | undefined;
  control: ActorControl;
}) {
  for (const peasant of beliefs.peasants) {
    if (isAssignedWorker({ peasant, rush })) {
      continue;
    }

    const resource =
      finishPeasantTraining({ beliefs, rush, townHall }) ??
      nextWorkerResource({ rush });

    if (resource === HOME_RESOURCE.GOLD) {
      rush.goldWorkers.push(peasant);
    } else {
      rush.lumberWorkers.push(peasant);
    }

    debug({
      message: `Tower rush: new Peasant joins ${HOME_RESOURCE[resource]} (${describeWorkers({ rush })}).`,
    });

    if (
      !beliefs.harvestingUnits.includes(peasant) &&
      control.request({ actor: peasant, request: NORMAL_REQUEST }) &&
      !orderHarvest({ worker: peasant, resource, beliefs })
    ) {
      debug({
        message: `Tower rush: ${HOME_RESOURCE[resource]} harvest order rejected.`,
      });
    }
  }
}

// The Town Hall has a single rally point, which a Peasant follows when it
// leaves training. It is pointed at the next Peasant's resource only once
// the previous one has left, so queueing does not redirect that one.
function finishPeasantTraining({
  beliefs,
  rush,
  townHall,
}: {
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
  townHall: W3UnitApi.unit | undefined;
}): HOME_RESOURCE | undefined {
  const finished = rush.peasantsInTraining.shift();
  const next = rush.peasantsInTraining[0];

  if (finished !== undefined && next !== undefined) {
    rush.peasantTrainingStartedAt += PeasantTrainingSeconds;

    if (townHall) {
      setRally({ townHall, resource: next, beliefs });
    }
  }

  return finished;
}

function nextWorkerResource({ rush }: { rush: TowerRushState }): HOME_RESOURCE {
  const targets = currentWorkerTargets({ rush });

  return targets && plannedWorkers({ rush }).gold < targets.gold
    ? HOME_RESOURCE.GOLD
    : HOME_RESOURCE.LUMBER;
}

// The first stage not yet reached; undefined once all are.
function currentWorkerTargets({
  rush,
}: {
  rush: TowerRushState;
}): WorkerTargets | undefined {
  const planned = plannedWorkers({ rush });

  return WorkerTargetStages.find(
    (targets) => planned.gold < targets.gold || planned.lumber < targets.lumber
  );
}

// Assigned workers together with the Peasants still in training.
function plannedWorkers({ rush }: { rush: TowerRushState }): WorkerTargets {
  const inTraining = ({ resource }: { resource: HOME_RESOURCE }) =>
    rush.peasantsInTraining.filter((planned) => planned === resource).length;

  return {
    gold:
      rush.goldWorkers.length + inTraining({ resource: HOME_RESOURCE.GOLD }),
    lumber:
      rush.lumberWorkers.length +
      inTraining({ resource: HOME_RESOURCE.LUMBER }),
  };
}

function describeWorkers({ rush }: { rush: TowerRushState }): string {
  return `${rush.goldWorkers.length} gold, ${rush.lumberWorkers.length} lumber`;
}

function returnIdleWorkersToTheirResource({
  beliefs,
  rush,
  control,
}: {
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
  control: ActorControl;
}) {
  // Requested before checking idleness, so busy workers stay controlled too.
  const isReturning = ({ worker }: { worker: W3UnitApi.unit }) =>
    control.request({ actor: worker, request: NORMAL_REQUEST }) &&
    beliefs.idleUnits.includes(worker);

  for (const worker of rush.goldWorkers) {
    if (isReturning({ worker })) {
      orderHarvestGold({ worker, beliefs });
    }
  }

  for (const worker of rush.lumberWorkers) {
    if (isReturning({ worker })) {
      orderHarvestPreferredTree({ worker, beliefs });
    }
  }
}

// A training Town Hall still reports no current order, so production tracks
// its own Peasants in training to avoid queueing more than are needed.
function maintainPeasantProduction({
  beliefs,
  rush,
  townHall,
}: {
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
  townHall: W3UnitApi.unit | undefined;
}) {
  const homeWorkersMissing = currentWorkerTargets({ rush }) !== undefined;

  if (
    homeWorkersMissing &&
    canQueuePeasant({ beliefs, rush }) &&
    townHall &&
    beliefs.gold - goldReservedForUpgrades({ beliefs, rush }) >= PeasantGoldCost
  ) {
    trainPeasant({ townHall, beliefs, rush });
  }
}

// The next Peasant is queued shortly before the current one finishes, so the
// Town Hall does not stand idle until the next update notices, while the
// gold is not tied up in the queue for long. Warcraft exposes no training
// progress, so it is estimated from the fixed training time.
function canQueuePeasant({
  beliefs,
  rush,
}: {
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
}): boolean {
  const queued = rush.peasantsInTraining.length;
  const currentProgress =
    (beliefs.time - rush.peasantTrainingStartedAt) / PeasantTrainingSeconds;

  return (
    queued === 0 ||
    (queued === 1 && currentProgress >= QueueNextPeasantAtProgress)
  );
}

// A Guard Tower upgrade is paid when it starts, so an upgrading tower no
// longer needs reserved gold.
function goldReservedForUpgrades({
  beliefs,
  rush,
}: {
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
}): number {
  if (!rush.reservingGoldForUpgrades) {
    return 0;
  }

  const towersAwaitingUpgrade = beliefs.scoutTowers.filter(
    (tower) => !beliefs.buildingsUpgrading.includes(tower)
  );

  return towersAwaitingUpgrade.length * GUARD_TOWER_UPGRADE_GOLD_COST;
}

function trainPeasant({
  townHall,
  beliefs,
  rush,
}: {
  townHall: W3UnitApi.unit;
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
}) {
  const resource = nextWorkerResource({ rush });
  const startsNow = rush.peasantsInTraining.length === 0;

  if (startsNow) {
    setRally({ townHall, resource, beliefs });
  }

  if (W3UnitApi.IssueImmediateOrderById(townHall, W3HumanApi.Unit.PEASANT)) {
    if (startsNow) {
      rush.peasantTrainingStartedAt = beliefs.time;
    }

    rush.peasantsInTraining.push(resource);
    debug({
      message: `Tower rush: Peasant training ${startsNow ? 'ordered' : 'queued'} for ${HOME_RESOURCE[resource]}.`,
    });
  } else {
    debug({ message: 'Tower rush: Peasant training order rejected.' });
  }
}

function setRally({
  townHall,
  resource,
  beliefs,
}: {
  townHall: W3UnitApi.unit;
  resource: HOME_RESOURCE;
  beliefs: Readonly<CommonBeliefs>;
}) {
  const target = rallyTarget({ townHall, resource, beliefs });

  if (!W3UnitApi.IssueTargetOrder(townHall, 'setrally', target)) {
    debug({
      message: `Tower rush: rally to ${HOME_RESOURCE[resource]} rejected.`,
    });
  }
}

// The rallied destructable is not checked to be a tree; a Peasant rallied to
// anything else does not start harvesting and is then ordered to a real tree.
// A rallied Peasant leaves from the Town Hall, so the tree is chosen as seen
// from there.
function rallyTarget({
  townHall,
  resource,
  beliefs,
}: {
  townHall: W3UnitApi.unit;
  resource: HOME_RESOURCE;
  beliefs: Readonly<CommonBeliefs>;
}): W3UnitApi.unit | W3DestructableApi.destructable {
  if (resource === HOME_RESOURCE.GOLD) {
    if (!beliefs.homeGoldMine) {
      throw new Error('Tower rush: home gold mine not found.');
    }

    return beliefs.homeGoldMine.unit;
  }

  const nearest = lumberDestructablesByPreference({
    beliefs,
    peasantOrigin: townHall,
  })[0];

  if (!nearest) {
    throw new Error('Tower rush: no destructable near home to rally to.');
  }

  return nearest.destructable;
}

function isAssignedWorker({
  peasant,
  rush,
}: {
  peasant: W3UnitApi.unit;
  rush: TowerRushState;
}): boolean {
  return (
    rush.forwardWorkers.includes(peasant) ||
    rush.goldWorkers.includes(peasant) ||
    rush.lumberWorkers.includes(peasant)
  );
}

function orderHarvest({
  worker,
  resource,
  beliefs,
}: {
  worker: W3UnitApi.unit;
  resource: HOME_RESOURCE;
  beliefs: Readonly<CommonBeliefs>;
}): boolean {
  return resource === HOME_RESOURCE.GOLD
    ? orderHarvestGold({ worker, beliefs })
    : orderHarvestPreferredTree({ worker, beliefs });
}

function orderHarvestGold({
  worker,
  beliefs,
}: {
  worker: W3UnitApi.unit;
  beliefs: Readonly<CommonBeliefs>;
}): boolean {
  if (!beliefs.homeGoldMine) {
    throw new Error('Tower rush: home gold mine not found.');
  }

  return W3UnitApi.IssueTargetOrder(
    worker,
    'harvest',
    beliefs.homeGoldMine.unit
  );
}

// Beliefs cannot tell trees apart from other destructables, so the harvest
// order itself is used as the test: Warcraft rejects it for non-trees.
function orderHarvestPreferredTree({
  worker,
  beliefs,
}: {
  worker: W3UnitApi.unit;
  beliefs: Readonly<CommonBeliefs>;
}): boolean {
  for (const { destructable } of lumberDestructablesByPreference({
    beliefs,
    peasantOrigin: worker,
  })) {
    if (W3UnitApi.IssueTargetOrder(worker, 'harvest', destructable)) {
      return true;
    }
  }

  debug({ message: 'Tower rush: no nearby tree accepted a harvest order.' });

  return false;
}
