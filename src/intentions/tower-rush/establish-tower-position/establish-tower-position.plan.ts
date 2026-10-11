import { BeliefContainer, Plan, PlanStatus } from "@lib/bdi";
import { Point } from "@lib/math";
import { debug } from "../../../debug";
import { Actor, ActorControl } from "../../../actor";
import { CommonBeliefModel } from "../../../beliefs/common.beliefs";
import { TowerRushState } from "../tower-rush.state";
import { updateStart } from "./start";
import { createMoveForwardState, updateMoveForward } from "./move-forward";
import { createBuildTowersState, updateBuildTowers } from "./build-towers";
import { updateUpgradeTowers } from "./upgrade-towers";

enum Step {
  Start,
  MoveForward,
  BuildTowers,
  UpgradeTowers,
}

/**
 * Sends the forward workers next to the enemy main, builds the rush towers
 * there, and upgrades them to Guard Towers. Succeeds once every rush tower is
 * a Guard Tower.
 *
 * Each step requests the Actors it orders, so the plan's control moves with
 * the step: e.g. the forward Peasants are released once the towers are built.
 */
export class EstablishTowerPositionPlan
  implements Plan<BeliefContainer, Actor>
{
  private readonly common: CommonBeliefModel;
  private readonly rush: TowerRushState;
  private currentStatus: PlanStatus = "running";
  private step = Step.Start;
  private readonly moveForward = createMoveForwardState();
  private readonly buildTowers = createBuildTowersState();
  // Where the rush towers stood when BuildTowers ended.
  private towerPositions: Point[] = [];

  public constructor(common: CommonBeliefModel, rush: TowerRushState) {
    this.common = common;
    this.rush = rush;
  }

  public get status(): PlanStatus {
    return this.currentStatus;
  }

  /** Whether building the rush towers has finished. */
  public get towersBuilt(): boolean {
    return this.step === Step.UpgradeTowers;
  }

  public update(container: Readonly<BeliefContainer>, control: ActorControl) {
    if (this.currentStatus !== "running") {
      throw new Error("Establish tower position: updated after it ended.");
    }

    const beliefs = container.get(this.common);

    switch (this.step) {
      case Step.Start:
        updateStart(beliefs, this.rush, control);
        this.advanceTo(Step.MoveForward);
        break;

      case Step.MoveForward:
        if (updateMoveForward(beliefs, this.rush, this.moveForward, control)) {
          this.advanceTo(Step.BuildTowers);
        }
        break;

      case Step.BuildTowers: {
        const towerPositions = updateBuildTowers(
          beliefs,
          this.rush,
          this.buildTowers,
          control,
        );

        if (towerPositions) {
          this.towerPositions = towerPositions;
          this.advanceTo(Step.UpgradeTowers);
        }
        break;
      }

      case Step.UpgradeTowers:
        if (updateUpgradeTowers(beliefs, this.towerPositions, control)) {
          this.currentStatus = "succeeded";
          debug(
            `Establish tower position: ${Step[this.step]} -> ${this.currentStatus}`,
          );
        }
        break;
    }
  }

  private advanceTo(next: Step) {
    debug(`Establish tower position: ${Step[this.step]} -> ${Step[next]}`);
    this.step = next;
  }
}
