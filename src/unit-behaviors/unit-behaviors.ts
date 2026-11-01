import type { DirectiveStatus } from '@lib/chain-of-command';
import type { Random } from '@lib/math';
import type { Beliefs } from '../contracts/beliefs';
import type { Directive } from '../contracts/directives';
import type { UnitId } from '../contracts/ids';
import type { WarlordDirectiveStatuses } from '../contracts/intentions';
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
  /**
   * Starts the step, before the plan runs: the reflexes claim the units they
   * protect, and the status of every Directive in effect catches up with the
   * Beliefs. The runs read those statuses to see how their Directives are
   * going.
   */
  startStep({ beliefs }: { beliefs: Beliefs }): {
    directiveStatuses: WarlordDirectiveStatuses;
  };

  /**
   * Whether a reflex claimed the unit in this step. The mind leaves such
   * units out of their owners' forces, so no run directs or probes them.
   */
  protects({ unit }: { unit: UnitId }): boolean;

  /**
   * Gives each unit its Directive, in place of its current one. A Directive
   * for the task its unit is still pending or underway with takes over that
   * one's status instead of starting anew.
   */
  direct({ directives }: { directives: readonly Directive[] }): void;

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
      isLasting({ task: directiveState.directive.task }) &&
      isOngoing({ directiveState })
    ) {
      directiveState.ordered = false;
      directiveState.status = 'pending';
    }
  };

  const noteProgress = ({
    ownUnit,
    directiveState,
    beliefs,
  }: NoteProgressArgs) => {
    const { task } = directiveState.directive;

    if (
      !isLasting({ task }) ||
      directiveState.status === 'done' ||
      directiveState.status === 'failed'
    ) {
      return;
    }

    if (carriesOut({ task, ownUnit, beliefs })) {
      directiveState.ordered = true;
      directiveState.status = 'underway';
    } else if (directiveState.ordered) {
      directiveState.status = 'done';
    }
  };

  const carryOutLasting = ({
    ownUnit,
    directiveState,
    beliefs,
  }: CarryOutLastingArgs) => {
    const { task, reason } = directiveState.directive;

    if (directiveState.status !== 'pending') {
      return;
    }

    if (carriesOut({ task, ownUnit, beliefs })) {
      directiveState.ordered = true;
      directiveState.status = 'underway';
      return;
    }

    directiveState.ordered = true;
    orders.queue({
      order: orderFor({ task, unit: ownUnit.unit, reason }),
      onRefused: () => {
        directiveState.status = 'failed';
      },
    });
  };

  // Produce points the rally first, in a step of its own, so each unit
  // takes at most one order per step.
  const carryOutSingle = ({ unit, directiveState }: CarryOutSingleArgs) => {
    const { task, reason } = directiveState.directive;

    if (directiveState.status !== 'pending') {
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
        directiveState.status = 'done';
        return;
      }

      rallies.set(unit, task.rallyTarget);
    }

    directiveState.status = 'done';
    orders.queue({
      order: orderFor({ task, unit, reason }),
      onRefused: () => {
        directiveState.status = 'failed';
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

      const directiveStatuses = new Map<Directive, DirectiveStatus>();

      for (const directiveState of directiveStates.values()) {
        directiveStatuses.set(directiveState.directive, directiveState.status);
      }

      return { directiveStatuses };
    },

    protects({ unit }) {
      return workerSafety.protects({ worker: unit });
    },

    direct({ directives }) {
      for (const directive of directives) {
        const currentDirectiveState = directiveStates.get(directive.unit);

        if (
          currentDirectiveState !== undefined &&
          isOngoing({ directiveState: currentDirectiveState }) &&
          sameTask({
            a: currentDirectiveState.directive.task,
            b: directive.task,
          })
        ) {
          currentDirectiveState.directive = directive;
        } else {
          directiveStates.set(directive.unit, {
            directive,
            status: 'pending',
            ordered: false,
          });
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
          if (isLasting({ task: directiveState.directive.task })) {
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
  const { status } = directiveState;

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
  // The Directive in effect: the last one given for the task, which is the
  // one its run looks its status up by.
  directive: Directive;
  status: DirectiveStatus;
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
