import { PlanStatus } from '@lib/bdi';
import { Point } from '@lib/math';
import { debug } from '../../../../debug';
import { ActorControl } from '../../../../actor';
import {
  AssembledWarlordComponent,
  WarlordBeliefs,
  WarlordPlan,
} from '../../../../execution';
import { TowerRushState } from '../tower-rush.state';
import { updateStart } from './start';
import { createMoveForwardState, updateMoveForward } from './move-forward';
import { createBuildTowersState, updateBuildTowers } from './build-towers';
import { updateUpgradeTowers } from './upgrade-towers';

export { type EstablishTowerPositionPlan, assembleEstablishTowerPositionPlan };

enum STEP {
  START,
  MOVE_FORWARD,
  BUILD_TOWERS,
  UPGRADE_TOWERS,
}

/**
 * Sends the forward workers next to the enemy main, builds the rush towers
 * there, and upgrades them to Guard Towers. Succeeds once every rush tower is
 * a Guard Tower.
 *
 * Each step requests the Actors it orders, so the plan's control moves with
 * the step: e.g. the forward Peasants are released once the towers are built.
 */
interface EstablishTowerPositionPlan extends WarlordPlan {
  /** Whether building the rush towers has finished. */
  readonly towersBuilt: boolean;
}

interface EstablishTowerPositionUpdateArgs {
  beliefs: WarlordBeliefs;
  actorControl: ActorControl;
}

class EstablishTowerPosition implements EstablishTowerPositionPlan {
  private readonly rush: TowerRushState;
  private currentStatus: PlanStatus = 'running';
  private step = STEP.START;
  private readonly moveForward = createMoveForwardState();
  private readonly buildTowers = createBuildTowersState();
  // Where the rush towers stood when BuildTowers ended.
  private towerPositions: Point[] = [];

  public constructor({ rush }: { rush: TowerRushState }) {
    this.rush = rush;
  }

  public get status(): PlanStatus {
    return this.currentStatus;
  }

  public get towersBuilt(): boolean {
    return this.step === STEP.UPGRADE_TOWERS;
  }

  public update({
    beliefs: { commonBeliefs: beliefs },
    actorControl,
  }: EstablishTowerPositionUpdateArgs) {
    if (this.currentStatus !== 'running') {
      throw new Error('Establish tower position: updated after it ended.');
    }

    switch (this.step) {
      case STEP.START:
        updateStart({ beliefs, rush: this.rush, actorControl });
        this.advanceTo({ nextStep: STEP.MOVE_FORWARD });
        break;

      case STEP.MOVE_FORWARD:
        if (
          updateMoveForward({
            beliefs,
            rush: this.rush,
            moveForwardState: this.moveForward,
            actorControl,
          }).arrived
        ) {
          this.advanceTo({ nextStep: STEP.BUILD_TOWERS });
        }
        break;

      case STEP.BUILD_TOWERS: {
        const { towerPositions } = updateBuildTowers({
          beliefs,
          rush: this.rush,
          buildTowersState: this.buildTowers,
          actorControl,
        });

        if (towerPositions) {
          this.towerPositions = towerPositions;
          this.advanceTo({ nextStep: STEP.UPGRADE_TOWERS });
        }
        break;
      }

      case STEP.UPGRADE_TOWERS:
        if (
          updateUpgradeTowers({
            beliefs,
            towerPositions: this.towerPositions,
            actorControl,
          }).allUpgraded
        ) {
          this.currentStatus = 'succeeded';
          debug({
            message: `Establish tower position: ${STEP[this.step]} -> ${this.currentStatus}`,
          });
        }
        break;
    }
  }

  private advanceTo({ nextStep }: { nextStep: STEP }) {
    debug({
      message: `Establish tower position: ${STEP[this.step]} -> ${STEP[nextStep]}`,
    });
    this.step = nextStep;
  }
}

interface AssembleEstablishTowerPositionPlanArgs {
  rush: TowerRushState;
}

function assembleEstablishTowerPositionPlan({
  rush,
}: AssembleEstablishTowerPositionPlanArgs): AssembledWarlordComponent<EstablishTowerPositionPlan> {
  return { component: new EstablishTowerPosition({ rush }), children: [] };
}
