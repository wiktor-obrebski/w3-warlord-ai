import type { PlanRunStepArgs, PlanStep } from '@lib/chain-of-command';
import type { Beliefs } from '../../contracts/beliefs';
import type { UnitId } from '../../contracts/ids';
import type {
  WarlordNeeds,
  WarlordPlanRun,
  WarlordResource,
} from '../../contracts/intentions';
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
 * each of them directs apart.
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
   * The forward workers, every other Peasant for the home economy, the Town
   * Hall training them, and the Scout Towers to upgrade. Until the start
   * picks the forward workers, every Peasant counts as a home worker.
   */
  public needs({ beliefs }: { beliefs: Beliefs }): WarlordNeeds {
    const { peasants, townHall, scoutTowers } = beliefs.self;

    return {
      units: [
        {
          name: 'forward workers',
          matches: ({ unit }) => this.rush.forwardWorkers.includes(unit),
        },
        {
          name: 'home workers',
          matches: ({ unit }) => peasants.includes(unit),
        },
        { name: 'Town Hall', matches: ({ unit }) => unit === townHall },
        {
          name: 'Scout Towers',
          matches: ({ unit }) => scoutTowers.includes(unit),
        },
      ],
    };
  }

  /**
   * The establishing steps start on the first step. Their first step
   * assigns the workers the economy manages and gives Directives that step's
   * Beliefs predate, so the economy starts from the next step on.
   * Maintenance relies on a tower's life fraction reflecting damage, not
   * build progress, so it starts once the towers are built. The establishing
   * steps are let go once they have ended.
   */
  public step({
    beliefs,
    force,
  }: PlanRunStepArgs<Beliefs, UnitId, WarlordResource>): PlanStep {
    const { directives, probes, recorder, random } = this.capabilities;

    if (!this.steppedBefore) {
      this.establishing = new EstablishingSteps({
        rush: this.rush,
        capabilities: { directives, probes, recorder, random },
      });
    } else {
      this.economy ??= new TowerRushEconomyController({
        rush: this.rush,
        capabilities: { directives, probes, recorder },
      });
    }

    if (this.establishing?.towersBuilt) {
      this.towerMaintenance ??= new TowerMaintenanceController({
        rush: this.rush,
        capabilities: { directives, recorder },
      });
    }

    if (this.establishing) {
      this.establishing.update({ beliefs, force });

      if (this.establishing.established) {
        this.establishing = null;
      }
    }

    this.economy?.update({ beliefs, force });
    this.towerMaintenance?.update({ beliefs, force });
    this.steppedBefore = true;

    return { status: 'running' };
  }
}
