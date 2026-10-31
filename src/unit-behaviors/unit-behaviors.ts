import type { Random } from '@lib/math';
import type { ActorControl } from '../contracts/actor-control';
import type { Beliefs } from '../contracts/beliefs';
import type {
  Directives,
  DirectiveStatus,
  Task,
} from '../contracts/directives';
import type { UnitId } from '../contracts/ids';
import type { OrderQueue, OrderTarget } from '../contracts/orders';
import type { WarcraftProbes } from '../contracts/probes';
import type { DecisionRecorder } from '../contracts/record';
import type { OwnUnit } from '../contracts/world';
import { TowerTargeting } from './tower-targeting';
import { WorkerSafety } from './worker-safety';
import { carriesOut, isLasting, orderFor, sameTarget, sameTask } from './tasks';

export {
  type UnitBehaviors,
  type UnitBehaviorsCapabilities,
  createUnitBehaviors,
};

interface UnitBehaviorsCapabilities {
  readonly actorControl: ActorControl;
  readonly orders: OrderQueue;
  readonly probes: WarcraftProbes;
  readonly recorder: DecisionRecorder;
  readonly random: Random;
  // Whether an accepted probe ordered the unit during this step.
  wasProbed({ unit }: { unit: UnitId }): boolean;
}

/**
 * What every own unit does. A unit's owner gives it a Directive, and each
 * step its behavior turns the Directive into an order. The workers' reflex
 * comes first: it may take a worker over to keep it alive, and the worker
 * starts its unfinished Directive anew once let go. A Guard Tower without a
 * Directive in progress picks its own targets.
 */
interface UnitBehaviors {
  /** How plan runs give their units Directives. */
  readonly directives: Directives;

  /**
   * Starts the step, before the plan runs: the reflexes claim, under actor
   * control, the units they protect, so no run directs or probes them, and
   * the progress of every Directive catches up with the Beliefs, so the runs
   * read how their Directives are going now.
   */
  startStep({ beliefs }: { beliefs: Beliefs }): void;

  /**
   * Orders each own unit for the step, after the plan runs. A unit a probe
   * ordered in this step is left alone until the next.
   */
  decide({ beliefs }: { beliefs: Beliefs }): void;
}

interface CreateUnitBehaviorsArgs {
  capabilities: UnitBehaviorsCapabilities;
}

function createUnitBehaviors({
  capabilities,
}: CreateUnitBehaviorsArgs): UnitBehaviors {
  const { orders } = capabilities;
  const workerSafety = new WorkerSafety({ capabilities });
  const towerTargeting = new TowerTargeting({ capabilities });
  const directiveStates = new Map<UnitId, DirectiveState>();
  // The rally each producer was last ordered to point at. A refused rally
  // is not tried again for the same target, so production goes on.
  const rallies = new Map<UnitId, OrderTarget>();

  const isRallied = ({ producer, rallyTarget }: IsRalliedArgs): boolean => {
    const currentRally = rallies.get(producer);

    return (
      currentRally !== undefined &&
      sameTarget({ a: currentRally, b: rallyTarget })
    );
  };

  const pointRally = ({ producer, rallyTarget, reason }: PointRallyArgs) => {
    rallies.set(producer, rallyTarget);
    orders.queue({
      order: orderFor({
        task: { kind: 'Rally', rallyTarget },
        unit: producer,
        reason,
      }),
    });
  };

  const interrupt = ({ directiveState }: InterruptArgs) => {
    if (
      isLasting({ task: directiveState.task }) &&
      isOngoing({ directiveState })
    ) {
      directiveState.ordered = false;
      directiveState.progress.status = 'pending';
    }
  };

  const noteProgress = ({
    ownUnit,
    directiveState,
    beliefs,
  }: NoteProgressArgs) => {
    const { task, progress } = directiveState;

    if (
      !isLasting({ task }) ||
      progress.status === 'done' ||
      progress.status === 'failed'
    ) {
      return;
    }

    if (carriesOut({ task, ownUnit, beliefs })) {
      directiveState.ordered = true;
      progress.status = 'underway';
    } else if (directiveState.ordered) {
      progress.status = 'done';
    }
  };

  const carryOutLasting = ({
    ownUnit,
    directiveState,
    beliefs,
  }: CarryOutLastingArgs) => {
    const { task, progress } = directiveState;

    if (progress.status !== 'pending') {
      return;
    }

    if (carriesOut({ task, ownUnit, beliefs })) {
      directiveState.ordered = true;
      progress.status = 'underway';
      return;
    }

    directiveState.ordered = true;
    orders.queue({
      order: orderFor({
        task,
        unit: ownUnit.unit,
        reason: directiveState.reason,
      }),
      onRefused: () => {
        progress.status = 'failed';
      },
    });
  };

  // Produce points the rally first, in a step of its own, so each unit
  // takes at most one order per step.
  const carryOutSingle = ({ unit, directiveState }: CarryOutSingleArgs) => {
    const { task, progress, reason } = directiveState;

    if (progress.status !== 'pending') {
      return;
    }

    if (
      task.kind === 'Produce' &&
      task.rallyTarget !== undefined &&
      !isRallied({ producer: unit, rallyTarget: task.rallyTarget })
    ) {
      pointRally({
        producer: unit,
        rallyTarget: task.rallyTarget,
        reason: `Rally first: ${reason}`,
      });
      return;
    }

    if (task.kind === 'Rally') {
      if (isRallied({ producer: unit, rallyTarget: task.rallyTarget })) {
        progress.status = 'done';
        return;
      }

      rallies.set(unit, task.rallyTarget);
    }

    progress.status = 'done';
    orders.queue({
      order: orderFor({ task, unit, reason }),
      onRefused: () => {
        progress.status = 'failed';
      },
    });
  };

  const forgetLostUnits = ({ beliefs }: { beliefs: Beliefs }) => {
    for (const memoryByUnit of [directiveStates, rallies]) {
      const lostUnits: UnitId[] = [];

      for (const unit of memoryByUnit.keys()) {
        if (!beliefs.self.units.has(unit)) {
          lostUnits.push(unit);
        }
      }

      for (const unit of lostUnits) {
        memoryByUnit.delete(unit);
      }
    }
  };

  return {
    directives: {
      give({ unit, task, reason }) {
        const currentDirectiveState = directiveStates.get(unit);

        if (currentDirectiveState) {
          const { progress } = currentDirectiveState;

          if (
            isOngoing({ directiveState: currentDirectiveState }) &&
            sameTask({ a: currentDirectiveState.task, b: task })
          ) {
            return progress;
          }

          if (progress.status === 'pending') {
            progress.status = 'failed';
          } else if (progress.status === 'underway') {
            progress.status = 'done';
          }
        }

        const directiveState: DirectiveState = {
          task,
          reason,
          progress: { status: 'pending' },
          ordered: false,
        };

        directiveStates.set(unit, directiveState);

        return directiveState.progress;
      },
    },

    startStep({ beliefs }) {
      workerSafety.claim({ beliefs });
      towerTargeting.startStep({ beliefs });
      forgetLostUnits({ beliefs });

      for (const ownUnit of beliefs.self.units.values()) {
        const directiveState = directiveStates.get(ownUnit.unit);

        if (directiveState === undefined) {
          continue;
        }

        // A fleeing worker would look as if it carried out a Move.
        if (workerSafety.protects({ worker: ownUnit.unit })) {
          interrupt({ directiveState });
        } else {
          noteProgress({ ownUnit, directiveState, beliefs });
        }
      }
    },

    decide({ beliefs }) {
      for (const ownUnit of beliefs.self.units.values()) {
        if (capabilities.wasProbed({ unit: ownUnit.unit })) {
          continue;
        }

        if (workerSafety.protects({ worker: ownUnit.unit })) {
          workerSafety.protect({ worker: ownUnit, beliefs });
          continue;
        }

        const directiveState = directiveStates.get(ownUnit.unit);

        if (directiveState !== undefined && isOngoing({ directiveState })) {
          if (isLasting({ task: directiveState.task })) {
            carryOutLasting({ ownUnit, directiveState, beliefs });
          } else {
            carryOutSingle({ unit: ownUnit.unit, directiveState });
          }
        } else if (isFinishedGuardTower({ unit: ownUnit.unit, beliefs })) {
          towerTargeting.aim({ tower: ownUnit.unit, beliefs });
        }
      }
    },
  };
}

interface IsOngoingArgs {
  directiveState: DirectiveState;
}

function isOngoing({ directiveState }: IsOngoingArgs): boolean {
  const { status } = directiveState.progress;

  return status === 'pending' || status === 'underway';
}

interface IsFinishedGuardTowerArgs {
  unit: UnitId;
  beliefs: Beliefs;
}

// A tower upgrading to a Guard Tower may already have its type; it is left
// alone until the upgrade ends.
function isFinishedGuardTower({
  unit,
  beliefs,
}: IsFinishedGuardTowerArgs): boolean {
  return (
    beliefs.self.guardTowers.includes(unit) &&
    !beliefs.self.buildingsUpgrading.includes(unit)
  );
}

interface DirectiveState {
  readonly task: Task;
  readonly reason: string;
  readonly progress: { status: DirectiveStatus };
  // Whether the unit was ordered, or seen carrying the task out, since the
  // task last started.
  ordered: boolean;
}

interface IsRalliedArgs {
  producer: UnitId;
  rallyTarget: OrderTarget;
}

interface PointRallyArgs {
  producer: UnitId;
  rallyTarget: OrderTarget;
  reason: string;
}

interface InterruptArgs {
  directiveState: DirectiveState;
}

interface NoteProgressArgs {
  ownUnit: OwnUnit;
  directiveState: DirectiveState;
  beliefs: Beliefs;
}

interface CarryOutLastingArgs {
  ownUnit: OwnUnit;
  directiveState: DirectiveState;
  beliefs: Beliefs;
}

interface CarryOutSingleArgs {
  unit: UnitId;
  directiveState: DirectiveState;
}
