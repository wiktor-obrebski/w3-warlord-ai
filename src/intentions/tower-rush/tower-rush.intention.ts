import { Intention } from "@lib/bdi";
import { GlobalBeliefs } from "../../beliefs/global.beliefs";
import { WorkerSafety } from "../maintain-worker-safety/worker-safety.ctrl";
import { UpdateInterval } from "../update-interval";
import { createTowerRushState } from "./tower-rush.state";
import { forgetHidingOfUnsafeWorkers } from "./forward-workers";
import { EstablishTowerPositionPlan } from "./establish-tower-position/establish-tower-position.plan";
import { TowerRushEconomyController } from "./tower-rush-economy.ctrl";
import { TowerMaintenanceController } from "./tower-maintenance.ctrl";

const UPDATE_SECONDS = 1;

/**
 * Commitment to a Human tower rush: Guard Towers established next to the
 * enemy main, funded by a home economy and kept repaired by the forward
 * workers.
 */
export class TowerRushIntention implements Intention<GlobalBeliefs> {
  private readonly interval = new UpdateInterval(UPDATE_SECONDS);
  private readonly rush = createTowerRushState();
  private readonly workerSafety: WorkerSafety;
  private readonly establishTowerPosition: EstablishTowerPositionPlan;
  private readonly economy: TowerRushEconomyController;
  private readonly towerMaintenance: TowerMaintenanceController;
  private updatedBefore = false;

  public constructor(workerSafety: WorkerSafety) {
    this.workerSafety = workerSafety;
    this.establishTowerPosition = new EstablishTowerPositionPlan(
      this.rush,
      workerSafety,
    );
    this.economy = new TowerRushEconomyController(this.rush, workerSafety);
    this.towerMaintenance = new TowerMaintenanceController(
      this.rush,
      workerSafety,
    );
  }

  /** Whether every rush tower stands as a Guard Tower. */
  public get positionEstablished(): boolean {
    return this.establishTowerPosition.status === "succeeded";
  }

  public update(beliefs: Readonly<GlobalBeliefs>) {
    if (!this.interval.claim(beliefs.time)) {
      return;
    }

    forgetHidingOfUnsafeWorkers(beliefs, this.rush, this.workerSafety);

    // The plan's first update assigns the workers the economy manages and
    // issues orders these beliefs predate; running the economy on that
    // update would override them.
    if (this.updatedBefore) {
      this.economy.update(beliefs);
    }

    if (this.establishTowerPosition.towersBuilt) {
      this.towerMaintenance.update(beliefs);
    }

    if (this.establishTowerPosition.status === "running") {
      this.establishTowerPosition.update(beliefs);
    }

    this.updatedBefore = true;
  }
}
