import { Point, Random } from '@lib/math';
import type { ActorControl } from '../../../contracts/actor-control';
import type { Beliefs } from '../../../contracts/beliefs';
import type { Directives } from '../../../contracts/directives';
import type { WarcraftProbes } from '../../../contracts/probes';
import type { DecisionRecorder } from '../../../contracts/record';
import { TowerRushState } from '../tower-rush.state';
import { updateStart } from './start';
import { createMoveForwardState, updateMoveForward } from './move-forward';
import { createBuildTowersState, updateBuildTowers } from './build-towers';
import { updateUpgradeTowers } from './upgrade-towers';

export { EstablishingSteps, type EstablishingStepsCapabilities };

interface EstablishingStepsCapabilities {
  readonly actorControl: ActorControl;
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
}

/**
 * Sends the forward workers next to the enemy main, builds the rush towers
 * there, and upgrades them to Guard Towers. The tower position is
 * established once every rush tower is a Guard Tower.
 *
 * Each step requests the Actors it directs, so what the steps control follows
 * the step: e.g. they stop requesting the forward Peasants once the towers
 * are built.
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

  public update({ beliefs }: EstablishingStepsUpdateArgs) {
    if (this.hasEstablished) {
      throw new Error('Establishing steps: updated after they ended.');
    }

    const { actorControl, directives, probes, recorder, random } =
      this.capabilities;

    switch (this.step) {
      case STEP.START:
        updateStart({
          beliefs,
          rush: this.rush,
          actorControl,
          directives,
          probes,
          recorder,
        });
        this.advanceTo({ nextStep: STEP.MOVE_FORWARD });
        break;

      case STEP.MOVE_FORWARD:
        if (
          updateMoveForward({
            beliefs,
            rush: this.rush,
            moveForwardState: this.moveForward,
            actorControl,
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
          actorControl,
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
            actorControl,
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
