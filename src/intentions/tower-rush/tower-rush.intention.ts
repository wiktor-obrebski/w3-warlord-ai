import { ChildFactory, ChildHandle, childFactory } from "@lib/bdi";
import {
  ProvidedChildren,
  ProvidedComponent,
  WarlordBeliefs,
  WarlordController,
  WarlordIntention,
  WarlordUpdateChild,
} from "../../execution";
import { UpdateInterval } from "../update-interval";
import { createTowerRushState } from "./tower-rush.state";
import {
  EstablishTowerPositionPlan,
  provideEstablishTowerPositionPlan,
} from "./establish-tower-position/establish-tower-position.plan";
import { provideTowerRushEconomyController } from "./tower-rush-economy.ctrl";
import { provideTowerMaintenanceController } from "./tower-maintenance.ctrl";

const UPDATE_SECONDS = 1;

export interface TowerRushIntention extends WarlordIntention {
  /** Whether every rush tower stands as a Guard Tower. */
  readonly positionEstablished: boolean;
}

interface TowerRushChildFactories {
  readonly createEstablishTowerPositionPlan: ChildFactory<EstablishTowerPositionPlan>;
  readonly createEconomyController: ChildFactory<WarlordController>;
  readonly createTowerMaintenanceController: ChildFactory<WarlordController>;
}

/**
 * Commitment to a Human tower rush: Guard Towers established next to the
 * enemy main, funded by a home economy and kept repaired by the forward
 * workers.
 */
class TowerRush implements TowerRushIntention {
  private readonly interval = new UpdateInterval(UPDATE_SECONDS);
  private readonly factories: TowerRushChildFactories;
  private plan: ChildHandle<EstablishTowerPositionPlan> | null = null;
  private economy: WarlordController | null = null;
  private towerMaintenance: WarlordController | null = null;
  private established = false;
  private updatedBefore = false;

  public constructor(factories: TowerRushChildFactories) {
    this.factories = factories;
  }

  public get positionEstablished(): boolean {
    return this.established;
  }

  /**
   * The plan starts on the first update. Its first update assigns the
   * workers the economy manages and issues orders that tick's beliefs
   * predate, so the economy starts from the next update on. Maintenance
   * relies on a tower's life fraction reflecting damage, not build progress,
   * so it starts once the towers are built. The plan is discarded once it
   * has ended.
   *
   * Children are updated plan first: Actors it stops requesting, such as the
   * starting workers or the forward Peasants once the towers stand, are
   * released when its update ends, so the economy and maintenance take them
   * over in the same update.
   */
  public update(beliefs: WarlordBeliefs, updateChild: WarlordUpdateChild) {
    if (!this.interval.claim(beliefs.common.time)) {
      return;
    }

    if (!this.updatedBefore) {
      this.plan = this.factories.createEstablishTowerPositionPlan();
    } else {
      this.economy ??= this.factories.createEconomyController().value;
    }

    if (this.plan?.value.towersBuilt) {
      this.towerMaintenance ??=
        this.factories.createTowerMaintenanceController().value;
    }

    if (this.plan) {
      updateChild(this.plan.value);
      this.discardEndedPlan(this.plan);
    }

    if (this.economy) {
      updateChild(this.economy);
    }

    if (this.towerMaintenance) {
      updateChild(this.towerMaintenance);
    }

    this.updatedBefore = true;
  }

  private discardEndedPlan(plan: ChildHandle<EstablishTowerPositionPlan>) {
    const { status } = plan.value;

    if (status === "running") {
      return;
    }

    if (status === "failed") {
      throw new Error("Tower rush: establishing the tower position failed.");
    }

    plan.discard();
    this.plan = null;
    this.established = true;
  }
}

export function provideTowerRushIntention(): ProvidedComponent<TowerRushIntention> {
  const rush = createTowerRushState();
  const children: ProvidedChildren = [];

  return {
    value: new TowerRush({
      createEstablishTowerPositionPlan: childFactory(children, () =>
        provideEstablishTowerPositionPlan(rush),
      ),
      createEconomyController: childFactory(children, () =>
        provideTowerRushEconomyController(rush),
      ),
      createTowerMaintenanceController: childFactory(children, () =>
        provideTowerMaintenanceController(rush),
      ),
    }),
    children,
  };
}
