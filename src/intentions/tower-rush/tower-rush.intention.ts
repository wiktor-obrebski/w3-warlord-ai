import {
  BeliefContainer,
  Controller,
  Intention,
  Plan,
  UpdateChild,
} from "@lib/bdi";
import { ActorControl } from "../../actor";
import { CommonBeliefModel } from "../../beliefs/common.beliefs";
import { UpdateInterval } from "../update-interval";
import { createTowerRushState } from "./tower-rush.state";
import { EstablishTowerPositionPlan } from "./establish-tower-position/establish-tower-position.plan";
import { TowerRushEconomyController } from "./tower-rush-economy.ctrl";
import { TowerMaintenanceController } from "./tower-maintenance.ctrl";

const UPDATE_SECONDS = 1;

type TowerRushChild =
  | Plan<BeliefContainer, ActorControl>
  | Controller<BeliefContainer, ActorControl>;

/**
 * Commitment to a Human tower rush: Guard Towers established next to the
 * enemy main, funded by a home economy and kept repaired by the forward
 * workers.
 */
export class TowerRushIntention implements Intention<BeliefContainer, ActorControl> {
  private readonly common: CommonBeliefModel;
  private readonly interval = new UpdateInterval(UPDATE_SECONDS);
  private readonly rush = createTowerRushState();
  private readonly establishTowerPosition: EstablishTowerPositionPlan;
  private readonly economy: TowerRushEconomyController;
  private readonly towerMaintenance: TowerMaintenanceController;
  private updatedBefore = false;

  public constructor(common: CommonBeliefModel) {
    this.common = common;
    this.establishTowerPosition = new EstablishTowerPositionPlan(
      common,
      this.rush,
    );
    this.economy = new TowerRushEconomyController(common, this.rush);
    this.towerMaintenance = new TowerMaintenanceController(common, this.rush);
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
   *
   * The plan goes first: Actors it stops requesting, such as the starting
   * workers or the forward Peasants once the towers stand, are released when
   * its update ends, so the economy and maintenance take them over in the
   * same update.
   */
  public activeChildren(): readonly TowerRushChild[] {
    const children: TowerRushChild[] = [];

    if (this.establishTowerPosition.status === "running") {
      children.push(this.establishTowerPosition);
    }

    if (this.updatedBefore) {
      children.push(this.economy);
    }

    if (this.establishTowerPosition.towersBuilt) {
      children.push(this.towerMaintenance);
    }

    return children;
  }

  public update(
    beliefs: Readonly<BeliefContainer>,
    updateChild: UpdateChild<BeliefContainer, ActorControl>,
  ) {
    const common = beliefs.get(this.common);

    if (!this.interval.claim(common.time)) {
      return;
    }

    for (const child of this.activeChildren()) {
      updateChild(child);
    }

    this.updatedBefore = true;
  }
}
