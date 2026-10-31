import * as W3HumanApi from '@lib/warcraft3-api/human';
import type { ActorControl } from '../../contracts/actor-control';
import type { UnitId } from '../../contracts/ids';
import type { OrderQueue, OrderTarget } from '../../contracts/orders';
import type { WarcraftProbes } from '../../contracts/probes';
import type { DecisionRecorder } from '../../contracts/record';
import type { Beliefs } from '../../contracts/beliefs';
import { HOME_RESOURCE, TowerRushState } from './tower-rush.state';
import { lumberDestructablesByPreference } from './tower-rush.assessments';
import { GUARD_TOWER_UPGRADE_GOLD_COST } from './establishing/upgrade-towers';

export {
  TowerRushEconomyController,
  type TowerRushEconomyControllerCapabilities,
  trainPeasant,
};

interface TowerRushEconomyControllerCapabilities {
  readonly actorControl: ActorControl;
  readonly orders: OrderQueue;
  readonly probes: WarcraftProbes;
  readonly recorder: DecisionRecorder;
}

interface TowerRushEconomyControllerConstructorArgs {
  rush: TowerRushState;
  capabilities: TowerRushEconomyControllerCapabilities;
}

interface TowerRushEconomyControllerUpdateArgs {
  beliefs: Beliefs;
}

/**
 * The home economy that funds the tower rush. The Town Hall and every home
 * worker are requested on each update, so they stay controlled for as long as
 * the economy runs; one taken over meanwhile is left alone.
 */
class TowerRushEconomyController {
  private readonly rush: TowerRushState;
  private readonly capabilities: TowerRushEconomyControllerCapabilities;

  public constructor({
    rush,
    capabilities,
  }: TowerRushEconomyControllerConstructorArgs) {
    this.rush = rush;
    this.capabilities = capabilities;
  }

  public update({ beliefs }: TowerRushEconomyControllerUpdateArgs) {
    const { actorControl, orders, probes, recorder } = this.capabilities;
    const townHall =
      beliefs.self.townHall &&
      actorControl.request({
        actor: beliefs.self.townHall,
        request: 'normal',
      })
        ? beliefs.self.townHall
        : undefined;

    forgetDeadWorkers({ beliefs, rush: this.rush });
    assignNewHomeWorkers({
      beliefs,
      rush: this.rush,
      townHall,
      actorControl,
      orders,
      probes,
      recorder,
    });
    returnIdleWorkersToTheirResource({
      beliefs,
      rush: this.rush,
      actorControl,
      orders,
      probes,
      recorder,
    });
    maintainPeasantProduction({
      beliefs,
      rush: this.rush,
      townHall,
      orders,
      recorder,
    });
  }
}

interface TrainPeasantArgs {
  townHall: UnitId;
  beliefs: Beliefs;
  rush: TowerRushState;
  orders: OrderQueue;
  recorder: DecisionRecorder;
}

// Nothing reads the Peasants in training before a refusal comes back, at the
// start of the next step, so the refused one is still the last.
function trainPeasant({
  townHall,
  beliefs,
  rush,
  orders,
  recorder,
}: TrainPeasantArgs) {
  const resource = nextWorkerResource({ rush });
  const startsNow = rush.peasantsInTraining.length === 0;

  if (startsNow) {
    setRally({ townHall, resource, beliefs, orders });
    rush.peasantTrainingStartedAt = beliefs.time;
  }

  orders.queue({
    order: {
      kind: 'immediateById',
      unit: townHall,
      orderId: W3HumanApi.Unit.PEASANT,
      reason: `Tower rush: Peasant training for ${HOME_RESOURCE[resource]}`,
    },
    onRefused: () => {
      rush.peasantsInTraining.pop();
    },
  });
  rush.peasantsInTraining.push(resource);
  recorder.note({
    message: `Tower rush: Peasant training ${startsNow ? 'ordered' : 'queued'} for ${HOME_RESOURCE[resource]}.`,
  });
}

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

interface ForgetDeadWorkersArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
}

function forgetDeadWorkers({ beliefs, rush }: ForgetDeadWorkersArgs) {
  rush.goldWorkers = rush.goldWorkers.filter((worker) =>
    beliefs.self.peasants.includes(worker)
  );
  rush.lumberWorkers = rush.lumberWorkers.filter((worker) =>
    beliefs.self.peasants.includes(worker)
  );
}

interface AssignNewHomeWorkersArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
  townHall: UnitId | undefined;
  actorControl: ActorControl;
  orders: OrderQueue;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
}

// A trained Peasant leaves the Town Hall already harvesting the resource it
// was rallied to. It is only ordered when the rally did not start it
// harvesting, e.g. when the rallied destructable is not a tree.
function assignNewHomeWorkers({
  beliefs,
  rush,
  townHall,
  actorControl,
  orders,
  probes,
  recorder,
}: AssignNewHomeWorkersArgs) {
  for (const peasant of beliefs.self.peasants) {
    if (isAssignedWorker({ peasant, rush })) {
      continue;
    }

    const resource =
      finishPeasantTraining({ beliefs, rush, townHall, orders }) ??
      nextWorkerResource({ rush });

    if (resource === HOME_RESOURCE.GOLD) {
      rush.goldWorkers.push(peasant);
    } else {
      rush.lumberWorkers.push(peasant);
    }

    recorder.note({
      message: `Tower rush: new Peasant joins ${HOME_RESOURCE[resource]} (${describeWorkers({ rush })}).`,
    });

    if (
      !beliefs.self.harvestingUnits.includes(peasant) &&
      actorControl.request({ actor: peasant, request: 'normal' })
    ) {
      orderHarvest({
        worker: peasant,
        resource,
        beliefs,
        orders,
        probes,
        recorder,
      });
    }
  }
}

interface FinishPeasantTrainingArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
  townHall: UnitId | undefined;
  orders: OrderQueue;
}

// The Town Hall has a single rally point, which a Peasant follows when it
// leaves training. It is pointed at the next Peasant's resource only once
// the previous one has left, so queueing does not redirect that one.
function finishPeasantTraining({
  beliefs,
  rush,
  townHall,
  orders,
}: FinishPeasantTrainingArgs): HOME_RESOURCE | undefined {
  const finished = rush.peasantsInTraining.shift();
  const nextResource = rush.peasantsInTraining[0];

  if (finished !== undefined && nextResource !== undefined) {
    rush.peasantTrainingStartedAt += PeasantTrainingSeconds;

    if (townHall) {
      setRally({ townHall, resource: nextResource, beliefs, orders });
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

interface CurrentWorkerTargetsArgs {
  rush: TowerRushState;
}

// The first stage not yet reached; undefined once all are.
function currentWorkerTargets({
  rush,
}: CurrentWorkerTargetsArgs): WorkerTargets | undefined {
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

interface ReturnIdleWorkersToTheirResourceArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
  actorControl: ActorControl;
  orders: OrderQueue;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
}

function returnIdleWorkersToTheirResource({
  beliefs,
  rush,
  actorControl,
  orders,
  probes,
  recorder,
}: ReturnIdleWorkersToTheirResourceArgs) {
  // Requested before checking idleness, so busy workers stay controlled too.
  const isReturning = ({ worker }: { worker: UnitId }) =>
    actorControl.request({ actor: worker, request: 'normal' }) &&
    beliefs.self.idleUnits.includes(worker);

  for (const worker of rush.goldWorkers) {
    if (isReturning({ worker })) {
      orderHarvestGold({ worker, beliefs, orders });
    }
  }

  for (const worker of rush.lumberWorkers) {
    if (isReturning({ worker })) {
      orderHarvestPreferredTree({ worker, beliefs, probes, recorder });
    }
  }
}

interface MaintainPeasantProductionArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
  townHall: UnitId | undefined;
  orders: OrderQueue;
  recorder: DecisionRecorder;
}

// A training Town Hall still reports no current order, so production tracks
// its own Peasants in training to avoid queueing more than are needed.
function maintainPeasantProduction({
  beliefs,
  rush,
  townHall,
  orders,
  recorder,
}: MaintainPeasantProductionArgs) {
  const homeWorkersMissing = currentWorkerTargets({ rush }) !== undefined;

  if (
    homeWorkersMissing &&
    canQueuePeasant({ beliefs, rush }) &&
    townHall &&
    beliefs.self.gold - goldReservedForUpgrades({ beliefs, rush }) >=
      PeasantGoldCost
  ) {
    trainPeasant({ townHall, beliefs, rush, orders, recorder });
  }
}

interface CanQueuePeasantArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
}

// The next Peasant is queued shortly before the current one finishes, so the
// Town Hall does not stand idle until the next update notices, while the
// gold is not tied up in the queue for long. Warcraft exposes no training
// progress, so it is estimated from the fixed training time.
function canQueuePeasant({ beliefs, rush }: CanQueuePeasantArgs): boolean {
  const queued = rush.peasantsInTraining.length;
  const currentProgress =
    (beliefs.time - rush.peasantTrainingStartedAt) / PeasantTrainingSeconds;

  return (
    queued === 0 ||
    (queued === 1 && currentProgress >= QueueNextPeasantAtProgress)
  );
}

interface GoldReservedForUpgradesArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
}

// A Guard Tower upgrade is paid when it starts, so an upgrading tower no
// longer needs reserved gold.
function goldReservedForUpgrades({
  beliefs,
  rush,
}: GoldReservedForUpgradesArgs): number {
  if (!rush.reservingGoldForUpgrades) {
    return 0;
  }

  const towersAwaitingUpgrade = beliefs.self.scoutTowers.filter(
    (tower) => !beliefs.self.buildingsUpgrading.includes(tower)
  );

  return towersAwaitingUpgrade.length * GUARD_TOWER_UPGRADE_GOLD_COST;
}

interface SetRallyArgs {
  townHall: UnitId;
  resource: HOME_RESOURCE;
  beliefs: Beliefs;
  orders: OrderQueue;
}

function setRally({ townHall, resource, beliefs, orders }: SetRallyArgs) {
  orders.queue({
    order: {
      kind: 'target',
      unit: townHall,
      orderString: 'setrally',
      target: rallyTarget({ townHall, resource, beliefs }),
      reason: `Tower rush: rally to ${HOME_RESOURCE[resource]}`,
    },
  });
}

interface RallyTargetArgs {
  townHall: UnitId;
  resource: HOME_RESOURCE;
  beliefs: Beliefs;
}

// The rallied destructable is not checked to be a tree; a Peasant rallied to
// anything else does not start harvesting and is then ordered to a real tree.
// A rallied Peasant leaves from the Town Hall, so the tree is chosen as seen
// from there.
function rallyTarget({
  townHall,
  resource,
  beliefs,
}: RallyTargetArgs): OrderTarget {
  if (resource === HOME_RESOURCE.GOLD) {
    if (!beliefs.self.homeGoldMine) {
      throw new Error('Tower rush: home gold mine not found.');
    }

    return { unit: beliefs.self.homeGoldMine.unit };
  }

  const nearest = lumberDestructablesByPreference({
    beliefs,
    peasantOrigin: townHall,
  })[0];

  if (!nearest) {
    throw new Error('Tower rush: no destructable near home to rally to.');
  }

  return { destructable: nearest.destructable };
}

interface IsAssignedWorkerArgs {
  peasant: UnitId;
  rush: TowerRushState;
}

function isAssignedWorker({ peasant, rush }: IsAssignedWorkerArgs): boolean {
  return (
    rush.forwardWorkers.includes(peasant) ||
    rush.goldWorkers.includes(peasant) ||
    rush.lumberWorkers.includes(peasant)
  );
}

interface OrderHarvestArgs {
  worker: UnitId;
  resource: HOME_RESOURCE;
  beliefs: Beliefs;
  orders: OrderQueue;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
}

function orderHarvest({
  worker,
  resource,
  beliefs,
  orders,
  probes,
  recorder,
}: OrderHarvestArgs) {
  if (resource === HOME_RESOURCE.GOLD) {
    orderHarvestGold({ worker, beliefs, orders });
  } else {
    orderHarvestPreferredTree({ worker, beliefs, probes, recorder });
  }
}

interface OrderHarvestGoldArgs {
  worker: UnitId;
  beliefs: Beliefs;
  orders: OrderQueue;
}

function orderHarvestGold({ worker, beliefs, orders }: OrderHarvestGoldArgs) {
  if (!beliefs.self.homeGoldMine) {
    throw new Error('Tower rush: home gold mine not found.');
  }

  orders.queue({
    order: {
      kind: 'target',
      unit: worker,
      orderString: 'harvest',
      target: { unit: beliefs.self.homeGoldMine.unit },
      reason: 'Tower rush: gold worker harvests gold',
    },
  });
}

interface OrderHarvestPreferredTreeArgs {
  worker: UnitId;
  beliefs: Beliefs;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
}

// Beliefs cannot tell trees apart from other destructables, so the harvest
// order itself is used as the test: Warcraft rejects it for non-trees.
function orderHarvestPreferredTree({
  worker,
  beliefs,
  probes,
  recorder,
}: OrderHarvestPreferredTreeArgs) {
  for (const { destructable } of lumberDestructablesByPreference({
    beliefs,
    peasantOrigin: worker,
  })) {
    if (probes.tryHarvest({ unit: worker, destructable })) {
      return;
    }
  }

  recorder.note({
    message: 'Tower rush: no nearby tree accepted a harvest order.',
  });
}
