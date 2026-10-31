import type { PlanRunStepArgs, PlanStep } from '@lib/chain-of-command';
import type { Beliefs } from '../../contracts/beliefs';
import type { WarlordPlanRun } from '../../contracts/intentions';
import type { EstablishTowerPositionCapabilities } from './establish-tower-position.kind';
import { createTowerRushState } from './tower-rush.state';
import { EstablishingSteps } from './establishing/establishing-steps';
import { TowerRushEconomyController } from './tower-rush-economy.ctrl';
import { TowerMaintenanceController } from './tower-maintenance.ctrl';

export { TowerRushRun };

interface TowerRushRunConstructorArgs {
  capabilities: EstablishTowerPositionCapabilities;
}

/**
 * A Human tower rush with the starting Peasants: Guard Towers established
 * next to the enemy main, funded by a home economy and kept repaired by the
 * forward workers. It runs for as long as its Intention does.
 *
 * Its parts share the tower rush's execution state, which keeps the units
 * each of them orders apart.
 */
class TowerRushRun implements WarlordPlanRun {
  private readonly capabilities: EstablishTowerPositionCapabilities;
  private readonly rush = createTowerRushState();
  private establishing: EstablishingSteps | null = null;
  private economy: TowerRushEconomyController | null = null;
  private towerMaintenance: TowerMaintenanceController | null = null;
  private steppedBefore = false;

  public constructor({ capabilities }: TowerRushRunConstructorArgs) {
    this.capabilities = capabilities;
  }

  /**
   * The establishing steps start on the first step. Their first step
   * assigns the workers the economy manages and issues orders that step's
   * Beliefs predate, so the economy starts from the next step on.
   * Maintenance relies on a tower's life fraction reflecting damage, not
   * build progress, so it starts once the towers are built. The establishing
   * steps are let go once they have ended.
   */
  public step({ beliefs }: PlanRunStepArgs<Beliefs>): PlanStep {
    const { actorControl, orders, probes, recorder, random } =
      this.capabilities;

    if (!this.steppedBefore) {
      this.establishing = new EstablishingSteps({
        rush: this.rush,
        capabilities: { actorControl, orders, probes, recorder, random },
      });
    } else {
      this.economy ??= new TowerRushEconomyController({
        rush: this.rush,
        capabilities: { actorControl, orders, probes, recorder },
      });
    }

    if (this.establishing?.towersBuilt) {
      this.towerMaintenance ??= new TowerMaintenanceController({
        rush: this.rush,
        capabilities: { actorControl, orders, recorder },
      });
    }

    if (this.establishing) {
      this.establishing.update({ beliefs });

      if (this.establishing.established) {
        this.establishing = null;
      }
    }

    this.economy?.update({ beliefs });
    this.towerMaintenance?.update({ beliefs });
    this.steppedBefore = true;

    return { status: 'running' };
  }
}
