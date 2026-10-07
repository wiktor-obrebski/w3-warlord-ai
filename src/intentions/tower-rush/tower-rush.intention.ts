import { BeliefContainer, Controller, Intention, Plan } from "@lib/bdi";
import { CommonBeliefModel } from "../../beliefs/common.beliefs";
import { WorkerSafety } from "../maintain-worker-safety/worker-safety.ctrl";
import { UpdateInterval } from "../update-interval";
import { createTowerRushState } from "./tower-rush.state";
import { forgetHidingOfUnsafeWorkers } from "./forward-workers";
import { EstablishTowerPositionPlan } from "./establish-tower-position/establish-tower-position.plan";
import { TowerRushEconomyController } from "./tower-rush-economy.ctrl";
import { TowerMaintenanceController } from "./tower-maintenance.ctrl";

const UPDATE_SECONDS = 1;

type TowerRushChild = Plan<BeliefContainer> | Controller<BeliefContainer>;

/**
 * Commitment to a Human tower rush: Guard Towers established next to the
 * enemy main, funded by a home economy and kept repaired by the forward
 * workers.
 */
export class TowerRushIntention implements Intention<BeliefContainer> {
  private readonly common: CommonBeliefModel;
  private readonly interval = new UpdateInterval(UPDATE_SECONDS);
  private readonly rush = createTowerRushState();
  private readonly workerSafety: WorkerSafety;
  private readonly establishTowerPosition: EstablishTowerPositionPlan;
  private readonly economy: TowerRushEconomyController;
  private readonly towerMaintenance: TowerMaintenanceController;
  private updatedBefore = false;

  public constructor(common: CommonBeliefModel, workerSafety: WorkerSafety) {
    this.common = common;
    this.workerSafety = workerSafety;
    this.establishTowerPosition = new EstablishTowerPositionPlan(
      common,
      this.rush,
      workerSafety,
    );
    this.economy = new TowerRushEconomyController(
      common,
      this.rush,
      workerSafety,
    );
    this.towerMaintenance = new TowerMaintenanceController(
      common,
      this.rush,
      workerSafety,
    );
  }

  /** Whether every rush tower stands as a Guard Tower. */
  public get positionEstablished(): boolean {
    return this.establishTowerPosition.status === "succeeded";
  }

  /**
   * In update order. The plan's first update assigns the workers the economy
   * manages and issues orders that tick's beliefs predate, so the economy
   * joins from the next update on. Maintenance relies on a tower's life
   * fraction reflecting damage, not build progress, so it joins once the
   * towers are built.
   */
  public activeChildren(): readonly TowerRushChild[] {
    const children: TowerRushChild[] = [];

    if (this.updatedBefore) {
      children.push(this.economy);
    }

    if (this.establishTowerPosition.towersBuilt) {
      children.push(this.towerMaintenance);
    }

    if (this.establishTowerPosition.status === "running") {
      children.push(this.establishTowerPosition);
    }

    return children;
  }

  public update(beliefs: Readonly<BeliefContainer>) {
    const common = beliefs.get(this.common);

    if (!this.interval.claim(common.time)) {
      return;
    }

    forgetHidingOfUnsafeWorkers(beliefs, this.rush, this.workerSafety);

    for (const child of this.activeChildren()) {
      child.update(beliefs);
    }

    this.updatedBefore = true;
  }
}
