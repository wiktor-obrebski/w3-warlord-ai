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

  public constructor(rush: TowerRushState) {
    this.rush = rush;
  }

  public update({ common: beliefs }: WarlordBeliefs, control: ActorControl) {
    const enemyMain = beliefs.enemyStartPosition;

    if (!enemyMain) {
      throw new Error('Tower rush: enemy start position not found.');
    }

    const towers = [...beliefs.scoutTowers, ...beliefs.guardTowers];
    const previousTarget = this.repairTarget;
    const repairTarget = chooseRepairTarget(towers, previousTarget, beliefs);
    const targetChanged = repairTarget !== previousTarget;
    this.repairTarget = repairTarget;

    if (targetChanged) {
      debug(
        repairTarget
          ? `Tower rush: repairing ${describeTower(repairTarget, beliefs)}.`
          : 'Tower rush: no tower needs repair.'
      );
    }

    for (const worker of controlForwardPeasants(beliefs, this.rush, control)) {
      if (repairTarget) {
        if (targetChanged || !beliefs.repairingUnits.includes(worker)) {
          orderRepair(worker, repairTarget, beliefs, this.rush);
        }
      } else if (
        isAvailableForwardPeasant(beliefs, worker) &&
        !this.rush.forwardWorkersSentToSafety.includes(worker)
      ) {
        hideBehindClosestTower(worker, towers, enemyMain, beliefs, this.rush);
      }
    }
  }
}

function provideTowerMaintenanceController(
  rush: TowerRushState
): ProvidedComponent<WarlordController> {
  return { value: new TowerMaintenanceController(rush), children: [] };
}

function chooseRepairTarget(
  towers: readonly W3UnitApi.unit[],
  current: W3UnitApi.unit | undefined,
  beliefs: Readonly<CommonBeliefs>
): W3UnitApi.unit | undefined {
  const lifeFraction = (tower: W3UnitApi.unit) =>
    lifeFractionOf(beliefs, tower);
  const currentStanding = current !== undefined && towers.includes(current);

  if (currentStanding && lifeFraction(current) < RepairSwitchLifeFraction) {
    return current;
  }

  const mostDamaged = mostDamagedUnit(
    beliefs,
    towers.filter(
      (tower) =>
        tower !== current && lifeFraction(tower) < RepairStartLifeFraction
    )
  );

  if (mostDamaged) {
    return mostDamaged;
  }

  return currentStanding && lifeFraction(current) < 1 ? current : undefined;
}

function orderRepair(
  worker: W3UnitApi.unit,
  tower: W3UnitApi.unit,
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState
) {
  if (W3UnitApi.IssueTargetOrder(worker, 'repair', tower)) {
    forgetSentToSafety(worker, rush);
  } else {
    debug(
      `Tower rush: repair order rejected for ${describeTower(tower, beliefs)}.`
    );
  }
}

function describeTower(
  tower: W3UnitApi.unit,
  beliefs: Readonly<CommonBeliefs>
): string {
  const { life, maxLife } = ownUnit(beliefs, tower);

  return `a tower at ${Math.floor(life)}/${Math.floor(maxLife)} life`;
}
