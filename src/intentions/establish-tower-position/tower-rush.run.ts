import type { PlanRunStepArgs, PlanStep } from '@lib/chain-of-command';
import type { Beliefs } from '../../contracts/beliefs';
import type { UnitId } from '../../contracts/ids';
import type {
  WarlordNeeds,
  WarlordPlanRun,
  WarlordResource,
  WarlordUnitNeed,
} from '../../contracts/intentions';
import type { EstablishTowerPositionCapabilities } from './establish-tower-position.kind';
import { createTowerRushState } from './tower-rush.state';
import { FORWARD_WORKER_COUNT } from './tower-rush.assessments';
import { EstablishingSteps } from './establishing/establishing-steps';
import { TowerMaintenance } from './tower-maintenance';

export { TowerRushRun };

interface TowerRushRunConstructorArgs {
  capabilities: EstablishTowerPositionCapabilities;
}

/**
 * A Human tower rush with the starting Peasants: Guard Towers established
 * next to the enemy main and kept repaired by the forward workers. It runs
 * for as long as its Intention does.
 *
 * Its parts share the tower rush's execution state, which keeps the units
 * each of them directs apart.
 */
class TowerRushRun implements WarlordPlanRun {
  private readonly capabilities: EstablishTowerPositionCapabilities;
  private readonly rush = createTowerRushState();
  private establishing: EstablishingSteps | null;
  private towerMaintenance: TowerMaintenance | null = null;

  public constructor({ capabilities }: TowerRushRunConstructorArgs) {
    this.capabilities = capabilities;
    this.establishing = new EstablishingSteps({
      rush: this.rush,
      capabilities,
    });
  }

  /**
   * The forward workers, which the start picks from the Peasants it is
   * granted, and the Scout Towers to upgrade; the money for the towers and
   * their upgrades.
   */
  public needs({ beliefs }: { beliefs: Beliefs }): WarlordNeeds {
    const { peasants, scoutTowers } = beliefs.self;
    const { forwardWorkers } = this.rush;
    const forwardWorkersNeed: WarlordUnitNeed =
      forwardWorkers.length === 0
        ? {
            name: 'forward workers',
            matches: ({ unit }) => peasants.includes(unit),
            max: FORWARD_WORKER_COUNT,
          }
        : {
            name: 'forward workers',
            matches: ({ unit }) => forwardWorkers.includes(unit),
          };

    return {
      units: [
        forwardWorkersNeed,
        {
          name: 'Scout Towers',
          matches: ({ unit }) => scoutTowers.includes(unit),
        },
      ],
      money: this.establishing?.moneyNeeded({ beliefs }) ?? {
        gold: 0,
        lumber: 0,
      },
    };
  }

  /**
   * Maintenance relies on a tower's life fraction reflecting damage, not
   * build progress, so it starts once the towers are built. The establishing
   * steps are let go once they have ended.
   */
  public step({
    beliefs,
    force,
  }: PlanRunStepArgs<Beliefs, UnitId, WarlordResource>): PlanStep {
    const { directives, recorder } = this.capabilities;

    if (this.establishing?.towersBuilt) {
      this.towerMaintenance ??= new TowerMaintenance({
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

    this.towerMaintenance?.update({ beliefs, force });

    return { status: 'running' };
  }
}
