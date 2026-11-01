import * as W3HumanApi from '@lib/warcraft3-api/human';
import type { PlanRunStepArgs, PlanStep } from '@lib/chain-of-command';
import type { Beliefs } from '../../contracts/beliefs';
import type { BuildOrder, WorkerTargets } from '../../contracts/build-order';
import type { DirectiveProgress, Directives } from '../../contracts/directives';
import type { UnitId } from '../../contracts/ids';
import type {
  WarlordForce,
  WarlordNeeds,
  WarlordPlanRun,
  WarlordResource,
} from '../../contracts/intentions';
import type { OrderTarget } from '../../contracts/orders';
import type { WarcraftProbes } from '../../contracts/probes';
import type { DecisionRecorder } from '../../contracts/record';
import {
  createEconomyState,
  type EconomyState,
  HOME_RESOURCE,
} from './economy.state';
import { LUMBER_MILL_GOLD_COST, orderLumberMill } from './lumber-mill';
import {
  lumberDestructablesByPreference,
  positionOf,
} from './run-economy.judgments';
import type { RunEconomyCapabilities } from './run-economy.kind';

export { HumanEconomyRun };

interface HumanEconomyRunConstructorArgs {
  buildOrder: BuildOrder;
  capabilities: RunEconomyCapabilities;
}

/**
 * A Human home economy, built up as its build order says. On its first step,
 * its first worker puts up the opening buildings; from then on it trains
 * Peasants at the Town Hall, sends each to gold or lumber, stage by stage,
 * until the last stage of workers is reached, and returns idle workers to
 * their resource.
 */
class HumanEconomyRun implements WarlordPlanRun {
  private readonly buildOrder: BuildOrder;
  private readonly capabilities: RunEconomyCapabilities;
  private economy = createEconomyState();
  private openingOrdered = false;
  // How the Lumber Mill's Build Directive is going, once ordered.
  private lumberMillBuild: DirectiveProgress | undefined;

  public constructor({
    buildOrder,
    capabilities,
  }: HumanEconomyRunConstructorArgs) {
    for (const building of buildOrder.opening) {
      if (building !== W3HumanApi.Building.LUMBER_MILL) {
        throw new Error(
          `Economy: build order ${buildOrder.name} opens with building ${building}, which it cannot place.`
        );
      }
    }

    this.buildOrder = buildOrder;
    this.capabilities = capabilities;
  }

  /**
   * The Town Hall and every Peasant, of which it gets those the Intentions
   * before it on the agenda leave; the gold for the Lumber Mill until it is
   * placed, and for the next Peasant once one is due.
   */
  public needs({ beliefs }: { beliefs: Beliefs }): WarlordNeeds {
    const { peasants, townHall } = beliefs.self;
    // Allocation asks for the needs before the step catches the economy up,
    // so they read it as caught up; otherwise a Peasant training Warcraft
    // refused would get its gold an update late.
    const economy = caughtUp({ beliefs, economy: this.economy });
    const peasantGold = wantsPeasant({
      beliefs,
      economy,
      workerTargets: this.buildOrder.workerTargets,
    })
      ? PeasantGoldCost
      : 0;

    return {
      units: [
        { name: 'Town Hall', matches: ({ unit }) => unit === townHall },
        { name: 'workers', matches: ({ unit }) => peasants.includes(unit) },
      ],
      money: {
        gold: this.lumberMillGold({ beliefs }) + peasantGold,
        lumber: 0,
      },
    };
  }

  public step({
    beliefs,
    force,
  }: PlanRunStepArgs<Beliefs, UnitId, WarlordResource>): PlanStep {
    this.economy = caughtUp({ beliefs, economy: this.economy });

    const { directives, probes, recorder } = this.capabilities;
    const { economy } = this;
    const { workerTargets } = this.buildOrder;
    const townHall =
      beliefs.self.townHall !== undefined &&
      force.units.has(beliefs.self.townHall)
        ? beliefs.self.townHall
        : undefined;

    const opening = !this.openingOrdered;

    if (opening) {
      this.orderOpening({ beliefs, force });
      this.openingOrdered = true;
    }

    noteTrainedPeasants({
      beliefs,
      economy,
      workerTargets,
      townHall,
      directives,
    });
    assignNewWorkers({
      beliefs,
      economy,
      workerTargets,
      force,
      directives,
      probes,
      recorder,
    });

    // The opening step's Beliefs predate its orders, so the opening's builder
    // would read as idle and be sent back to harvest.
    if (!opening) {
      returnIdleWorkersToTheirResource({
        beliefs,
        economy,
        force,
        directives,
        probes,
        recorder,
      });
    }

    maintainPeasantProduction({
      beliefs,
      economy,
      workerTargets,
      townHall,
      gold: force.money.gold - this.lumberMillGold({ beliefs }),
      directives,
      recorder,
    });
    economy.knownUnits = new Set(beliefs.self.units.keys());

    return { status: 'running' };
  }

  // The first worker builds the opening, and counts as a lumber worker from
  // then on.
  private orderOpening({ beliefs, force }: HumanEconomyRunOrderOpeningArgs) {
    const { directives, probes, recorder } = this.capabilities;
    const { townHall, homeGoldMine } = beliefs.self;
    const builder = beliefs.self.peasants.find((peasant) =>
      force.units.has(peasant)
    );

    if (this.buildOrder.opening.length === 0) {
      return;
    }

    if (!townHall || !homeGoldMine || !builder) {
      throw new Error(
        'Economy: the opening needs a Town Hall, a home gold mine, and a worker.'
      );
    }

    // The opening is ordered on the run's first step only, so its gold must
    // be granted by then; spending gold not granted would take it from an
    // Intention ahead on the agenda.
    if (force.money.gold < LUMBER_MILL_GOLD_COST) {
      throw new Error(
        `Economy: the opening's Lumber Mill was granted ${force.money.gold} of its ${LUMBER_MILL_GOLD_COST} gold.`
      );
    }

    this.economy.lumberWorkers.push(builder);
    this.lumberMillBuild = orderLumberMill({
      builder,
      hall: positionOf({ beliefs, unit: townHall }),
      mine: homeGoldMine.position,
      beliefs,
      directives,
      probes,
      recorder,
    });
  }

  // The mill is paid for once placed, so its gold stays reserved from before
  // it is ordered until then, unless its order is refused or dropped.
  private lumberMillGold({ beliefs }: { beliefs: Beliefs }): number {
    const status = this.lumberMillBuild?.status;
    const unpaid =
      this.buildOrder.opening.includes(W3HumanApi.Building.LUMBER_MILL) &&
      beliefs.self.lumberMills.length === 0 &&
      (!this.openingOrdered || status === 'pending' || status === 'underway');

    return unpaid ? LUMBER_MILL_GOLD_COST : 0;
  }
}

interface HumanEconomyRunOrderOpeningArgs {
  beliefs: Beliefs;
  force: WarlordForce;
}

const PeasantGoldCost = 75;
// Warcraft's listed Peasant training time; not verified in-game.
const PeasantTrainingSeconds = 15;
const QueueNextPeasantAtProgress = 0.9;

interface TrainPeasantArgs {
  townHall: UnitId;
  beliefs: Beliefs;
  economy: EconomyState;
  workerTargets: readonly WorkerTargets[];
  directives: Directives;
  recorder: DecisionRecorder;
}

// A Peasant queued behind another leaves the rally to the one in training;
// the rally points at a Peasant's own resource only when it trains at once.
function trainPeasant({
  townHall,
  beliefs,
  economy,
  workerTargets,
  directives,
  recorder,
}: TrainPeasantArgs) {
  const resource = nextWorkerResource({ economy, workerTargets });
  const startsNow = economy.peasantsInTraining.length === 0;

  if (startsNow) {
    economy.peasantRally = rallyTarget({ townHall, resource, beliefs });
    economy.peasantTrainingStartedAt = beliefs.time;
  }

  economy.lastPeasantTraining = directives.give({
    unit: townHall,
    task: {
      kind: 'Produce',
      unitType: W3HumanApi.Unit.PEASANT,
      rallyTarget: economy.peasantRally,
    },
    reason: `Economy: Peasant training for ${HOME_RESOURCE[resource]}`,
  });
  economy.peasantsInTraining.push(resource);
  recorder.note({
    message: `Economy: Peasant training ${startsNow ? 'ordered' : 'queued'} for ${HOME_RESOURCE[resource]}.`,
  });
}

interface CaughtUpArgs {
  beliefs: Beliefs;
  economy: EconomyState;
}

// The economy without its dead workers and a Peasant training Warcraft
// refused. No Peasant is ordered between a refusal and the next update, so
// the refused one is still the last.
function caughtUp({ beliefs, economy }: CaughtUpArgs): EconomyState {
  const { peasants } = beliefs.self;
  const trainingRefused = economy.lastPeasantTraining?.status === 'failed';

  return {
    ...economy,
    goldWorkers: economy.goldWorkers.filter((worker) =>
      peasants.includes(worker)
    ),
    lumberWorkers: economy.lumberWorkers.filter((worker) =>
      peasants.includes(worker)
    ),
    trainedFor: new Map(
      [...economy.trainedFor].filter(([peasant]) => peasants.includes(peasant))
    ),
    peasantsInTraining: trainingRefused
      ? economy.peasantsInTraining.slice(0, -1)
      : economy.peasantsInTraining,
    lastPeasantTraining: trainingRefused
      ? undefined
      : economy.lastPeasantTraining,
  };
}

interface NoteTrainedPeasantsArgs {
  beliefs: Beliefs;
  economy: EconomyState;
  workerTargets: readonly WorkerTargets[];
  townHall: UnitId | undefined;
  directives: Directives;
}

// A Peasant that was not among the bot's units at the previous update has
// just left training, whether or not the economy holds it already.
function noteTrainedPeasants({
  beliefs,
  economy,
  workerTargets,
  townHall,
  directives,
}: NoteTrainedPeasantsArgs) {
  const { knownUnits } = economy;

  if (knownUnits === undefined) {
    return;
  }

  for (const peasant of beliefs.self.peasants) {
    if (!knownUnits.has(peasant)) {
      economy.trainedFor.set(
        peasant,
        finishPeasantTraining({ beliefs, economy, townHall, directives }) ??
          nextWorkerResource({ economy, workerTargets })
      );
    }
  }
}

interface AssignNewWorkersArgs {
  beliefs: Beliefs;
  economy: EconomyState;
  workerTargets: readonly WorkerTargets[];
  force: WarlordForce;
  directives: Directives;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
}

// A trained Peasant leaves the Town Hall already harvesting the resource it
// was rallied to. It is only ordered when the rally did not start it
// harvesting, e.g. when the rallied destructable is not a tree.
function assignNewWorkers({
  beliefs,
  economy,
  workerTargets,
  force,
  directives,
  probes,
  recorder,
}: AssignNewWorkersArgs) {
  for (const peasant of beliefs.self.peasants) {
    if (!force.units.has(peasant) || isAssignedWorker({ peasant, economy })) {
      continue;
    }

    const resource =
      economy.trainedFor.get(peasant) ??
      nextWorkerResource({ economy, workerTargets });

    economy.trainedFor.delete(peasant);

    if (resource === HOME_RESOURCE.GOLD) {
      economy.goldWorkers.push(peasant);
    } else {
      economy.lumberWorkers.push(peasant);
    }

    recorder.note({
      message: `Economy: Peasant joins ${HOME_RESOURCE[resource]} (${describeWorkers({ economy })}).`,
    });

    if (!beliefs.self.harvestingUnits.includes(peasant)) {
      orderHarvest({
        worker: peasant,
        resource,
        beliefs,
        directives,
        probes,
        recorder,
      });
    }
  }
}

interface FinishPeasantTrainingArgs {
  beliefs: Beliefs;
  economy: EconomyState;
  townHall: UnitId | undefined;
  directives: Directives;
}

// The Town Hall has a single rally point, which a Peasant follows when it
// leaves training. It is pointed at the next Peasant's resource only once
// the previous one has left, so queueing does not redirect that one.
function finishPeasantTraining({
  beliefs,
  economy,
  townHall,
  directives,
}: FinishPeasantTrainingArgs): HOME_RESOURCE | undefined {
  const finished = economy.peasantsInTraining.shift();
  const nextResource = economy.peasantsInTraining[0];

  if (finished !== undefined && nextResource !== undefined) {
    economy.peasantTrainingStartedAt += PeasantTrainingSeconds;

    if (townHall) {
      setRally({
        townHall,
        resource: nextResource,
        beliefs,
        economy,
        directives,
      });
    }
  }

  return finished;
}

interface NextWorkerResourceArgs {
  economy: EconomyState;
  workerTargets: readonly WorkerTargets[];
}

function nextWorkerResource({
  economy,
  workerTargets,
}: NextWorkerResourceArgs): HOME_RESOURCE {
  const targets = currentWorkerTargets({ economy, workerTargets });

  return targets && plannedWorkers({ economy }).gold < targets.gold
    ? HOME_RESOURCE.GOLD
    : HOME_RESOURCE.LUMBER;
}

interface CurrentWorkerTargetsArgs {
  economy: EconomyState;
  workerTargets: readonly WorkerTargets[];
}

// The first stage not yet reached; undefined once all are.
function currentWorkerTargets({
  economy,
  workerTargets,
}: CurrentWorkerTargetsArgs): WorkerTargets | undefined {
  const planned = plannedWorkers({ economy });

  return workerTargets.find(
    (targets) => planned.gold < targets.gold || planned.lumber < targets.lumber
  );
}

// Assigned workers together with the Peasants still in training.
function plannedWorkers({ economy }: { economy: EconomyState }): WorkerTargets {
  const inTraining = ({ resource }: { resource: HOME_RESOURCE }) =>
    economy.peasantsInTraining.filter((planned) => planned === resource).length;

  return {
    gold:
      economy.goldWorkers.length + inTraining({ resource: HOME_RESOURCE.GOLD }),
    lumber:
      economy.lumberWorkers.length +
      inTraining({ resource: HOME_RESOURCE.LUMBER }),
  };
}

function describeWorkers({ economy }: { economy: EconomyState }): string {
  return `${economy.goldWorkers.length} gold, ${economy.lumberWorkers.length} lumber`;
}

interface ReturnIdleWorkersToTheirResourceArgs {
  beliefs: Beliefs;
  economy: EconomyState;
  force: WarlordForce;
  directives: Directives;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
}

function returnIdleWorkersToTheirResource({
  beliefs,
  economy,
  force,
  directives,
  probes,
  recorder,
}: ReturnIdleWorkersToTheirResourceArgs) {
  const isReturning = ({ worker }: { worker: UnitId }) =>
    force.units.has(worker) && beliefs.self.idleUnits.includes(worker);

  for (const worker of economy.goldWorkers) {
    if (isReturning({ worker })) {
      orderHarvestGold({ worker, beliefs, directives });
    }
  }

  for (const worker of economy.lumberWorkers) {
    if (isReturning({ worker })) {
      orderHarvestPreferredTree({
        worker,
        beliefs,
        directives,
        probes,
        recorder,
      });
    }
  }
}

interface WantsPeasantArgs {
  beliefs: Beliefs;
  economy: EconomyState;
  workerTargets: readonly WorkerTargets[];
}

// A training Town Hall still reports no current order, so production tracks
// its own Peasants in training to avoid queueing more than are needed.
function wantsPeasant({
  beliefs,
  economy,
  workerTargets,
}: WantsPeasantArgs): boolean {
  return (
    beliefs.self.townHall !== undefined &&
    currentWorkerTargets({ economy, workerTargets }) !== undefined &&
    canQueuePeasant({ beliefs, economy })
  );
}

interface MaintainPeasantProductionArgs {
  beliefs: Beliefs;
  economy: EconomyState;
  workerTargets: readonly WorkerTargets[];
  townHall: UnitId | undefined;
  // The gold granted for Peasants.
  gold: number;
  directives: Directives;
  recorder: DecisionRecorder;
}

function maintainPeasantProduction({
  beliefs,
  economy,
  workerTargets,
  townHall,
  gold,
  directives,
  recorder,
}: MaintainPeasantProductionArgs) {
  if (
    townHall &&
    wantsPeasant({ beliefs, economy, workerTargets }) &&
    gold >= PeasantGoldCost
  ) {
    trainPeasant({
      townHall,
      beliefs,
      economy,
      workerTargets,
      directives,
      recorder,
    });
  }
}

interface CanQueuePeasantArgs {
  beliefs: Beliefs;
  economy: EconomyState;
}

// The next Peasant is queued shortly before the current one finishes, so the
// Town Hall does not stand idle until the next update notices, while the
// gold is not tied up in the queue for long. Warcraft exposes no training
// progress, so it is estimated from the fixed training time.
function canQueuePeasant({ beliefs, economy }: CanQueuePeasantArgs): boolean {
  const queued = economy.peasantsInTraining.length;
  const currentProgress =
    (beliefs.time - economy.peasantTrainingStartedAt) / PeasantTrainingSeconds;

  return (
    queued === 0 ||
    (queued === 1 && currentProgress >= QueueNextPeasantAtProgress)
  );
}

interface SetRallyArgs {
  townHall: UnitId;
  resource: HOME_RESOURCE;
  beliefs: Beliefs;
  economy: EconomyState;
  directives: Directives;
}

function setRally({
  townHall,
  resource,
  beliefs,
  economy,
  directives,
}: SetRallyArgs) {
  const rally = rallyTarget({ townHall, resource, beliefs });

  economy.peasantRally = rally;
  directives.give({
    unit: townHall,
    task: { kind: 'Rally', rallyTarget: rally },
    reason: `Economy: rally to ${HOME_RESOURCE[resource]}`,
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
      throw new Error('Economy: home gold mine not found.');
    }

    return { unit: beliefs.self.homeGoldMine.unit };
  }

  const nearest = lumberDestructablesByPreference({
    beliefs,
    peasantOrigin: townHall,
  })[0];

  if (!nearest) {
    throw new Error('Economy: no destructable near home to rally to.');
  }

  return { destructable: nearest.destructable };
}

interface IsAssignedWorkerArgs {
  peasant: UnitId;
  economy: EconomyState;
}

function isAssignedWorker({ peasant, economy }: IsAssignedWorkerArgs): boolean {
  return (
    economy.goldWorkers.includes(peasant) ||
    economy.lumberWorkers.includes(peasant)
  );
}

interface OrderHarvestArgs {
  worker: UnitId;
  resource: HOME_RESOURCE;
  beliefs: Beliefs;
  directives: Directives;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
}

function orderHarvest({
  worker,
  resource,
  beliefs,
  directives,
  probes,
  recorder,
}: OrderHarvestArgs) {
  if (resource === HOME_RESOURCE.GOLD) {
    orderHarvestGold({ worker, beliefs, directives });
  } else {
    orderHarvestPreferredTree({
      worker,
      beliefs,
      directives,
      probes,
      recorder,
    });
  }
}

interface OrderHarvestGoldArgs {
  worker: UnitId;
  beliefs: Beliefs;
  directives: Directives;
}

function orderHarvestGold({
  worker,
  beliefs,
  directives,
}: OrderHarvestGoldArgs) {
  if (!beliefs.self.homeGoldMine) {
    throw new Error('Economy: home gold mine not found.');
  }

  directives.give({
    unit: worker,
    task: {
      kind: 'Harvest',
      harvestTarget: { unit: beliefs.self.homeGoldMine.unit },
    },
    reason: 'Economy: gold worker harvests gold',
  });
}

interface OrderHarvestPreferredTreeArgs {
  worker: UnitId;
  beliefs: Beliefs;
  directives: Directives;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
}

// Beliefs cannot tell trees apart from other destructables, so the harvest
// order itself is used as the test: Warcraft rejects it for non-trees.
function orderHarvestPreferredTree({
  worker,
  beliefs,
  directives,
  probes,
  recorder,
}: OrderHarvestPreferredTreeArgs) {
  for (const { destructable } of lumberDestructablesByPreference({
    beliefs,
    peasantOrigin: worker,
  })) {
    if (probes.tryHarvest({ unit: worker, destructable })) {
      directives.give({
        unit: worker,
        task: { kind: 'Harvest', harvestTarget: { destructable } },
        reason: 'Economy: lumber worker harvests a tree',
      });
      return;
    }
  }

  recorder.note({
    message: 'Economy: no nearby tree accepted a harvest order.',
  });
}
