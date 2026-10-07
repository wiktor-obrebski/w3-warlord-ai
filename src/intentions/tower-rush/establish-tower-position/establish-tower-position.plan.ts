import { BeliefContainer, Plan, PlanStatus } from "@lib/bdi";
import { Point } from "@lib/math";
import { debug } from "../../../debug";
import { CommonBeliefModel } from "../../../beliefs/common.beliefs";
import {
  isWorkerSafe,
  WorkerSafety,
} from "../../maintain-worker-safety/worker-safety.ctrl";
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
 */
export class EstablishTowerPositionPlan implements Plan<BeliefContainer> {
  private readonly common: CommonBeliefModel;
  private readonly rush: TowerRushState;
  private readonly workerSafety: WorkerSafety;
  private currentStatus: PlanStatus = "running";
  private step = Step.Start;
  private readonly moveForward = createMoveForwardState();
  private readonly buildTowers = createBuildTowersState();
  // Where the rush towers stood when BuildTowers ended.
  private towerPositions: Point[] = [];

  public constructor(
    common: CommonBeliefModel,
    rush: TowerRushState,
    workerSafety: WorkerSafety,
  ) {
    this.common = common;
    this.rush = rush;
    this.workerSafety = workerSafety;
  }

  public get status(): PlanStatus {
    return this.currentStatus;
  }

  /** Whether building the rush towers has finished. */
  public get towersBuilt(): boolean {
    return this.step === Step.UpgradeTowers;
  }

  public update(container: Readonly<BeliefContainer>) {
    if (this.currentStatus !== "running") {
      throw new Error("Establish tower position: updated after it ended.");
    }

    const beliefs = container.get(this.common);

    switch (this.step) {
      case Step.Start:
        updateStart(beliefs, this.rush);
        this.advanceTo(Step.MoveForward);
        break;

      case Step.MoveForward:
        if (updateMoveForward(beliefs, this.rush, this.moveForward)) {
          this.advanceTo(Step.BuildTowers);
        }
        break;

      case Step.BuildTowers: {
        const towerPositions = updateBuildTowers(
          beliefs,
          this.rush,
          this.buildTowers,
          (worker) => isWorkerSafe(this.workerSafety, worker, container),
        );

        if (towerPositions) {
          this.towerPositions = towerPositions;
          this.advanceTo(Step.UpgradeTowers);
        }
        break;
      }

      case Step.UpgradeTowers:
        if (updateUpgradeTowers(beliefs, this.towerPositions)) {
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
