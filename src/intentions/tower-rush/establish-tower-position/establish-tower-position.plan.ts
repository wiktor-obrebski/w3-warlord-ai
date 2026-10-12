import { PlanStatus } from '@lib/bdi';
import { Point } from '@lib/math';
import { debug } from '../../../debug';
import { ActorControl } from '../../../actor';
import {
  ProvidedComponent,
  WarlordBeliefs,
  WarlordPlan,
} from '../../../execution';
import { TowerRushState } from '../tower-rush.state';
import { updateStart } from './start';
import { createMoveForwardState, updateMoveForward } from './move-forward';
import { createBuildTowersState, updateBuildTowers } from './build-towers';
import { updateUpgradeTowers } from './upgrade-towers';

export { type EstablishTowerPositionPlan, provideEstablishTowerPositionPlan };

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

class EstablishTowerPosition implements EstablishTowerPositionPlan {
  private readonly rush: TowerRushState;
  private currentStatus: PlanStatus = 'running';
  private step = STEP.START;
  private readonly moveForward = createMoveForwardState();
  private readonly buildTowers = createBuildTowersState();
  // Where the rush towers stood when BuildTowers ended.
  private towerPositions: Point[] = [];

  public constructor(rush: TowerRushState) {
    this.rush = rush;
  }

  public get status(): PlanStatus {
    return this.currentStatus;
  }

  public get towersBuilt(): boolean {
    return this.step === STEP.UPGRADE_TOWERS;
  }

  public update({ common: beliefs }: WarlordBeliefs, control: ActorControl) {
    if (this.currentStatus !== 'running') {
      throw new Error('Establish tower position: updated after it ended.');
    }

    switch (this.step) {
      case STEP.START:
        updateStart(beliefs, this.rush, control);
        this.advanceTo(STEP.MOVE_FORWARD);
        break;

      case STEP.MOVE_FORWARD:
        if (updateMoveForward(beliefs, this.rush, this.moveForward, control)) {
          this.advanceTo(STEP.BUILD_TOWERS);
        }
        break;

      case STEP.BUILD_TOWERS: {
        const towerPositions = updateBuildTowers(
          beliefs,
          this.rush,
          this.buildTowers,
          control
        );

        if (towerPositions) {
          this.towerPositions = towerPositions;
          this.advanceTo(STEP.UPGRADE_TOWERS);
        }
        break;
      }

      case STEP.UPGRADE_TOWERS:
        if (updateUpgradeTowers(beliefs, this.towerPositions, control)) {
          this.currentStatus = 'succeeded';
          debug(
            `Establish tower position: ${STEP[this.step]} -> ${this.currentStatus}`
          );
        }
        break;
    }
  }

  private advanceTo(next: STEP) {
    debug(`Establish tower position: ${STEP[this.step]} -> ${STEP[next]}`);
    this.step = next;
  }
}

function provideEstablishTowerPositionPlan(
  rush: TowerRushState
): ProvidedComponent<EstablishTowerPositionPlan> {
  return { value: new EstablishTowerPosition(rush), children: [] };
}
