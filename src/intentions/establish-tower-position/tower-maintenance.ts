import type { UnitId } from '../../contracts/ids';
import type { Directives } from '../../contracts/directives';
import type { WarlordForce } from '../../contracts/intentions';
import type { DecisionRecorder } from '../../contracts/record';
import type { Beliefs } from '../../contracts/beliefs';
import { TowerRushState } from './tower-rush.state';
import {
  forgetSentToSafety,
  forwardPeasantsInForce,
  hideBehindClosestTower,
} from './forward-workers';
import {
  isAvailableForwardPeasant,
  lifeFractionOf,
  mostDamagedUnit,
  ownUnit,
} from './tower-rush.assessments';

export { TowerMaintenance, type TowerMaintenanceCapabilities };

interface TowerMaintenanceCapabilities {
  readonly directives: Directives;
  readonly recorder: DecisionRecorder;
}

interface TowerMaintenanceConstructorArgs {
  rush: TowerRushState;
  capabilities: TowerMaintenanceCapabilities;
}

interface TowerMaintenanceUpdateArgs {
  beliefs: Beliefs;
  force: WarlordForce;
}

/**
 * The forward Peasants of the force repair the most damaged tower, and hide
 * behind the towers when none needs repair. Only to be used once every rush
 * tower is built, so a tower's life fraction reflects damage, not build
 * progress.
 */
class TowerMaintenance {
  private readonly rush: TowerRushState;
  private readonly capabilities: TowerMaintenanceCapabilities;
  // The tower the forward Peasants are repairing.
  private repairTarget: UnitId | undefined;

  public constructor({ rush, capabilities }: TowerMaintenanceConstructorArgs) {
    this.rush = rush;
    this.capabilities = capabilities;
  }

  public update({ beliefs, force }: TowerMaintenanceUpdateArgs) {
    const enemyMain = beliefs.enemy.startPosition;

    if (!enemyMain) {
      throw new Error('Tower rush: enemy start position not found.');
    }

    const { directives, recorder } = this.capabilities;
    const towers = [...beliefs.self.scoutTowers, ...beliefs.self.guardTowers];
    const previousTarget = this.repairTarget;
    const repairTarget = chooseRepairTarget({
      towers,
      currentRepairTarget: previousTarget,
      beliefs,
    });
    const targetChanged = repairTarget !== previousTarget;
    this.repairTarget = repairTarget;

    if (targetChanged) {
      recorder.note({
        message: repairTarget
          ? `Tower rush: repairing ${describeTower({ tower: repairTarget, beliefs })}.`
          : 'Tower rush: no tower needs repair.',
      });
    }

    for (const worker of forwardPeasantsInForce({
      beliefs,
      rush: this.rush,
      force,
    })) {
      if (repairTarget) {
        if (targetChanged || !beliefs.self.repairingUnits.includes(worker)) {
          orderRepair({
            worker,
            tower: repairTarget,
            rush: this.rush,
            directives,
          });
        }
      } else if (
        isAvailableForwardPeasant({ beliefs, worker }) &&
        !this.rush.forwardWorkersSentToSafety.includes(worker)
      ) {
        hideBehindClosestTower({
          worker,
          towers,
          enemyMain,
          beliefs,
          rush: this.rush,
          directives,
          recorder,
        });
      }
    }
  }
}

// A repair starts below the start fraction and is not interrupted before the
// switch fraction; above it, a tower below the start fraction takes over,
// otherwise the repair goes on to full life.
const RepairStartLifeFraction = 0.6;
const RepairSwitchLifeFraction = 0.8;

interface ChooseRepairTargetArgs {
  towers: readonly UnitId[];
  currentRepairTarget: UnitId | undefined;
  beliefs: Beliefs;
}

function chooseRepairTarget({
  towers,
  currentRepairTarget,
  beliefs,
}: ChooseRepairTargetArgs): UnitId | undefined {
  const lifeFraction = ({ tower }: { tower: UnitId }) =>
    lifeFractionOf({ beliefs, unit: tower });
  const currentStanding =
    currentRepairTarget !== undefined && towers.includes(currentRepairTarget);

  if (
    currentStanding &&
    lifeFraction({ tower: currentRepairTarget }) < RepairSwitchLifeFraction
  ) {
    return currentRepairTarget;
  }

  const mostDamaged = mostDamagedUnit({
    beliefs,
    units: towers.filter(
      (tower) =>
        tower !== currentRepairTarget &&
        lifeFraction({ tower }) < RepairStartLifeFraction
    ),
  });

  if (mostDamaged) {
    return mostDamaged;
  }

  return currentStanding && lifeFraction({ tower: currentRepairTarget }) < 1
    ? currentRepairTarget
    : undefined;
}

interface OrderRepairArgs {
  worker: UnitId;
  tower: UnitId;
  rush: TowerRushState;
  directives: Directives;
}

// A refused repair leaves the Peasant not repairing, so the next update
// orders it again.
function orderRepair({ worker, tower, rush, directives }: OrderRepairArgs) {
  directives.give({
    unit: worker,
    task: { kind: 'Repair', repairTarget: tower },
    reason: 'Tower rush: forward Peasant repairs a tower',
  });
  forgetSentToSafety({ worker, rush });
}

interface DescribeTowerArgs {
  tower: UnitId;
  beliefs: Beliefs;
}

function describeTower({ tower, beliefs }: DescribeTowerArgs): string {
  const { life, maxLife } = ownUnit({ beliefs, unit: tower });

  return `a tower at ${Math.floor(life)}/${Math.floor(maxLife)} life`;
}
