import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { debug } from '../../../debug';
import type { ActorControl } from '../../../contracts/actor-control';
import type {
  AssembledWarlordComponent,
  WarlordBeliefs,
  WarlordController,
} from '../../../contracts/component';
import type { TowerRushCommonBeliefs } from './tower-rush.common-beliefs';
import { TowerRushState } from './tower-rush.state';
import {
  controlForwardPeasants,
  forgetSentToSafety,
  hideBehindClosestTower,
} from './forward-workers';
import {
  isAvailableForwardPeasant,
  lifeFractionOf,
  mostDamagedUnit,
  ownUnit,
} from './tower-rush.assessments';

export { assembleTowerMaintenanceController };

interface AssembleTowerMaintenanceControllerArgs {
  rush: TowerRushState;
  capabilities: TowerMaintenanceControllerCapabilities;
}

function assembleTowerMaintenanceController({
  rush,
  capabilities,
}: AssembleTowerMaintenanceControllerArgs): AssembledWarlordComponent<
  WarlordController<TowerRushCommonBeliefs>,
  TowerRushCommonBeliefs
> {
  return {
    component: new TowerMaintenanceController({ rush, capabilities }),
    children: [],
  };
}

// A repair starts below the start fraction and is not interrupted before the
// switch fraction; above it, a tower below the start fraction takes over,
// otherwise the repair goes on to full life.
const RepairStartLifeFraction = 0.6;
const RepairSwitchLifeFraction = 0.8;

interface TowerMaintenanceControllerCapabilities {
  readonly actorControl: ActorControl;
}

interface TowerMaintenanceControllerConstructorArgs {
  rush: TowerRushState;
  capabilities: TowerMaintenanceControllerCapabilities;
}

interface TowerMaintenanceControllerUpdateArgs {
  beliefs: WarlordBeliefs<TowerRushCommonBeliefs>;
}

/**
 * The forward Peasants it controls repair the most damaged tower, and hide
 * behind the towers when none needs repair. Only to be used once every rush
 * tower is built, so a tower's life fraction reflects damage, not build
 * progress.
 */
class TowerMaintenanceController implements WarlordController<TowerRushCommonBeliefs> {
  private readonly rush: TowerRushState;
  private readonly capabilities: TowerMaintenanceControllerCapabilities;
  // The tower the forward Peasants are repairing.
  private repairTarget: W3UnitApi.unit | undefined;

  public constructor({
    rush,
    capabilities,
  }: TowerMaintenanceControllerConstructorArgs) {
    this.rush = rush;
    this.capabilities = capabilities;
  }

  public update({
    beliefs: { commonBeliefs: beliefs },
  }: TowerMaintenanceControllerUpdateArgs) {
    const enemyMain = beliefs.enemyStartPosition;

    if (!enemyMain) {
      throw new Error('Tower rush: enemy start position not found.');
    }

    const towers = [...beliefs.scoutTowers, ...beliefs.guardTowers];
    const previousTarget = this.repairTarget;
    const repairTarget = chooseRepairTarget({
      towers,
      currentRepairTarget: previousTarget,
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
      actorControl: this.capabilities.actorControl,
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

interface ChooseRepairTargetArgs {
  towers: readonly W3UnitApi.unit[];
  currentRepairTarget: W3UnitApi.unit | undefined;
  beliefs: Readonly<TowerRushCommonBeliefs>;
}

function chooseRepairTarget({
  towers,
  currentRepairTarget,
  beliefs,
}: ChooseRepairTargetArgs): W3UnitApi.unit | undefined {
  const lifeFraction = ({ tower }: { tower: W3UnitApi.unit }) =>
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
  worker: W3UnitApi.unit;
  tower: W3UnitApi.unit;
  beliefs: Readonly<TowerRushCommonBeliefs>;
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
  beliefs: Readonly<TowerRushCommonBeliefs>;
}

function describeTower({ tower, beliefs }: DescribeTowerArgs): string {
  const { life, maxLife } = ownUnit({ beliefs, unit: tower });

  return `a tower at ${Math.floor(life)}/${Math.floor(maxLife)} life`;
}
