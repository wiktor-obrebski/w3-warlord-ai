import { Point, Random } from '@lib/math';
import type { Beliefs } from '../../../contracts/beliefs';
import type { Directives } from '../../../contracts/directives';
import type { WarlordForce, WarlordMoney } from '../../../contracts/intentions';
import type { WarcraftProbes } from '../../../contracts/probes';
import type { DecisionRecorder } from '../../../contracts/record';
import { TowerRushState } from '../tower-rush.state';
import { updateStart } from './start';
import { createMoveForwardState, updateMoveForward } from './move-forward';
import {
  createBuildTowersState,
  towerBuildCosts,
  updateBuildTowers,
} from './build-towers';
import { updateUpgradeTowers, upgradeCosts } from './upgrade-towers';

export { EstablishingSteps, type EstablishingStepsCapabilities };

interface EstablishingStepsCapabilities {
  readonly directives: Directives;
  readonly probes: WarcraftProbes;
  readonly recorder: DecisionRecorder;
  readonly random: Random;
}

interface EstablishingStepsConstructorArgs {
  rush: TowerRushState;
  capabilities: EstablishingStepsCapabilities;
}

interface EstablishingStepsUpdateArgs {
  beliefs: Beliefs;
  force: WarlordForce;
}

/**
 * Sends the forward workers next to the enemy main, builds the rush towers
 * there, and upgrades them to Guard Towers. The tower position is
 * established once every rush tower is a Guard Tower. Each step directs only
 * units of the run's force.
 */
class EstablishingSteps {
  private readonly rush: TowerRushState;
  private readonly capabilities: EstablishingStepsCapabilities;
  private hasEstablished = false;
  private step = STEP.START;
  private readonly moveForward = createMoveForwardState();
  private readonly buildTowers = createBuildTowersState();
  // Where the rush towers stood when BuildTowers ended.
  private towerPositions: Point[] = [];

  public constructor({ rush, capabilities }: EstablishingStepsConstructorArgs) {
    this.rush = rush;
    this.capabilities = capabilities;
  }

  /** Whether every rush tower stands as a Guard Tower; the steps end then. */
  public get established(): boolean {
    return this.hasEstablished;
  }

  /** Whether building the rush towers has finished. */
  public get towersBuilt(): boolean {
    return this.step === STEP.UPGRADE_TOWERS;
  }

  /**
   * The money for the towers still to be built, while they are, and for the
   * upgrades still to start, once the towers are far enough along. The
   * upgrades require a Lumber Mill, so without one standing, even
   * unfinished, their money is not reserved.
   */
  public moneyNeeded({ beliefs }: { beliefs: Beliefs }): WarlordMoney {
    const towers =
      this.step === STEP.BUILD_TOWERS
        ? towerBuildCosts({ beliefs })
        : { gold: 0, lumber: 0 };
    const upgrades =
      this.rush.reservingForUpgrades && beliefs.self.lumberMills.length > 0
        ? upgradeCosts({ beliefs })
        : { gold: 0, lumber: 0 };

    return {
      gold: towers.gold + upgrades.gold,
      lumber: towers.lumber + upgrades.lumber,
    };
  }

  public update({ beliefs, force }: EstablishingStepsUpdateArgs) {
    if (this.hasEstablished) {
      throw new Error('Establishing steps: updated after they ended.');
    }

    const { directives, probes, recorder, random } = this.capabilities;

    switch (this.step) {
      case STEP.START:
        updateStart({ beliefs, rush: this.rush, force, directives });
        this.advanceTo({ nextStep: STEP.MOVE_FORWARD });
        break;

      case STEP.MOVE_FORWARD:
        if (
          updateMoveForward({
            beliefs,
            rush: this.rush,
            moveForwardState: this.moveForward,
            force,
            directives,
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
          force,
          directives,
          probes,
          recorder,
          random,
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
            force,
            directives,
            recorder,
          }).allUpgraded
        ) {
          this.establish();
        }
        break;
    }
  }

  private advanceTo({ nextStep }: { nextStep: STEP }) {
    this.reportPhaseChange({ to: STEP[nextStep] });
    this.step = nextStep;
  }

  private establish() {
    this.hasEstablished = true;
    this.reportPhaseChange({ to: 'established' });
  }

  private reportPhaseChange({ to }: { to: string }) {
    const from = STEP[this.step];

    this.capabilities.recorder.note({
      message: `Establish tower position: ${from} -> ${to}`,
      fields: { from, to },
    });
  }
}

enum STEP {
  START,
  MOVE_FORWARD,
  BUILD_TOWERS,
  UPGRADE_TOWERS,
}
