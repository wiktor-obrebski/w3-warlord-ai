import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { debug } from '../../debug';
import { ActorControl } from '../../actor';
import {
  ProvidedComponent,
  WarlordBeliefs,
  WarlordController,
} from '../../execution';
import { CommonBeliefs } from '../../beliefs/common.beliefs';
import {
  lifeFractionOf,
  mostDamagedUnit,
  ownUnit,
} from '../../beliefs/common.assessments';
import { TowerRushState } from './tower-rush.state';
import {
  controlForwardPeasants,
  forgetSentToSafety,
  hideBehindClosestTower,
} from './forward-workers';
import { isAvailableForwardPeasant } from './tower-rush.assessments';

export { provideTowerMaintenanceController };

// A repair starts below the start fraction and is not interrupted before the
// switch fraction; above it, a tower below the start fraction takes over,
// otherwise the repair goes on to full life.
const RepairStartLifeFraction = 0.6;
const RepairSwitchLifeFraction = 0.8;

interface TowerMaintenanceControllerUpdateArgs {
  beliefs: WarlordBeliefs;
  control: ActorControl;
}

/**
 * The forward Peasants it controls repair the most damaged tower, and hide
 * behind the towers when none needs repair. Only to be used once every rush
 * tower is built, so a tower's life fraction reflects damage, not build
 * progress.
 */
class TowerMaintenanceController implements WarlordController {
  private readonly rush: TowerRushState;
  // The tower the forward Peasants are repairing.
  private repairTarget: W3UnitApi.unit | undefined;

  public constructor({ rush }: { rush: TowerRushState }) {
    this.rush = rush;
  }

  public update({
    beliefs: { common: beliefs },
    control,
  }: TowerMaintenanceControllerUpdateArgs) {
    const enemyMain = beliefs.enemyStartPosition;

    if (!enemyMain) {
      throw new Error('Tower rush: enemy start position not found.');
    }

    const towers = [...beliefs.scoutTowers, ...beliefs.guardTowers];
    const previousTarget = this.repairTarget;
    const repairTarget = chooseRepairTarget({
      towers,
      current: previousTarget,
      beliefs,
    });
    const targetChanged = repairTarget !== previousTarget;
    this.repairTarget = repairTarget;

    if (targetChanged) {
      debug({
        message: repairTarget
          ? `Tower rush: repairing ${describeTower({ tower: repairTarget, beliefs })}.`
          : 'Tower rush: no tower needs repair.',
      });
    }

    for (const worker of controlForwardPeasants({
      beliefs,
      rush: this.rush,
      control,
    })) {
      if (repairTarget) {
        if (targetChanged || !beliefs.repairingUnits.includes(worker)) {
          orderRepair({
            worker,
            tower: repairTarget,
            beliefs,
            rush: this.rush,
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
        });
      }
    }
  }
}

interface ProvideTowerMaintenanceControllerArgs {
  rush: TowerRushState;
}

function provideTowerMaintenanceController({
  rush,
}: ProvideTowerMaintenanceControllerArgs): ProvidedComponent<WarlordController> {
  return {
    value: new TowerMaintenanceController({ rush }),
    children: [],
  };
}

interface ChooseRepairTargetArgs {
  towers: readonly W3UnitApi.unit[];
  current: W3UnitApi.unit | undefined;
  beliefs: Readonly<CommonBeliefs>;
}

function chooseRepairTarget({
  towers,
  current,
  beliefs,
}: ChooseRepairTargetArgs): W3UnitApi.unit | undefined {
  const lifeFraction = ({ tower }: { tower: W3UnitApi.unit }) =>
    lifeFractionOf({ beliefs, unit: tower });
  const currentStanding = current !== undefined && towers.includes(current);

  if (
    currentStanding &&
    lifeFraction({ tower: current }) < RepairSwitchLifeFraction
  ) {
    return current;
  }

  const mostDamaged = mostDamagedUnit({
    beliefs,
    units: towers.filter(
      (tower) =>
        tower !== current && lifeFraction({ tower }) < RepairStartLifeFraction
    ),
  });

  if (mostDamaged) {
    return mostDamaged;
  }

  return currentStanding && lifeFraction({ tower: current }) < 1
    ? current
    : undefined;
}

interface OrderRepairArgs {
  worker: W3UnitApi.unit;
  tower: W3UnitApi.unit;
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
}

function orderRepair({ worker, tower, beliefs, rush }: OrderRepairArgs) {
  if (W3UnitApi.IssueTargetOrder(worker, 'repair', tower)) {
    forgetSentToSafety({ worker, rush });
  } else {
    debug({
      message: `Tower rush: repair order rejected for ${describeTower({ tower, beliefs })}.`,
    });
  }
}

interface DescribeTowerArgs {
  tower: W3UnitApi.unit;
  beliefs: Readonly<CommonBeliefs>;
}

function describeTower({ tower, beliefs }: DescribeTowerArgs): string {
  const { life, maxLife } = ownUnit({ beliefs, unit: tower });

  return `a tower at ${Math.floor(life)}/${Math.floor(maxLife)} life`;
}
