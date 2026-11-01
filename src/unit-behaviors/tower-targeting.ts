import type { Beliefs } from '../contracts/beliefs';
import type { UnitId } from '../contracts/ids';
import type { WarcraftProbes } from '../contracts/probes';
import type { DecisionRecorder } from '../contracts/record';
import {
  RankedTarget,
  rankTowerTargets,
  TARGET_PRIORITY,
} from './tower-targeting.judgments';

export { TowerTargeting, type TowerTargetingCapabilities };

interface TowerTargetingCapabilities {
  readonly probes: WarcraftProbes;
  readonly recorder: DecisionRecorder;
}

interface TowerTargetingConstructorArgs {
  capabilities: TowerTargetingCapabilities;
}

interface TowerTargetingStartStepArgs {
  beliefs: Beliefs;
}

interface TowerTargetingAimArgs {
  tower: UnitId;
  beliefs: Beliefs;
}

interface TowerTargetingForgetLostTowersArgs {
  beliefs: Beliefs;
}

/**
 * The Guard Towers' fire, focused by target priority. On each targeting
 * pass, the targets are ranked once for all Guard Towers; each tower then
 * attacks the best one within its own range, so overlapping towers focus the
 * same target.
 */
class TowerTargeting {
  private readonly capabilities: TowerTargetingCapabilities;
  // The last attack order of each Guard Tower, so it is not re-issued while
  // the tower is still carrying it out.
  private readonly attackTargets = new Map<UnitId, UnitId>();
  // Undefined in the steps between targeting passes.
  private rankedTargets: RankedTarget[] | undefined;
  private nextPassAt = 0;

  public constructor({ capabilities }: TowerTargetingConstructorArgs) {
    this.capabilities = capabilities;
  }

  /**
   * Ranks the targets when a targeting pass is due. Passes come once a
   * second, so a tower does not switch targets whenever another enemy's
   * life drops below its target's.
   */
  public startStep({ beliefs }: TowerTargetingStartStepArgs) {
    this.forgetLostTowers({ beliefs });

    if (beliefs.time < this.nextPassAt) {
      this.rankedTargets = undefined;
      return;
    }

    this.rankedTargets = rankTowerTargets({ beliefs });
    this.nextPassAt = beliefs.time + PassSeconds;
  }

  // Re-issuing an attack the tower is already carrying out could restart its
  // attack, so the order is only issued when the target changes or the tower
  // has dropped it. A rejected target is skipped in favour of the next one.
  public aim({ tower, beliefs }: TowerTargetingAimArgs) {
    if (this.rankedTargets === undefined) {
      return;
    }

    const { probes, recorder } = this.capabilities;
    const currentAttackTarget = this.attackTargets.get(tower);
    const towerBusy = !beliefs.self.idleUnits.includes(tower);

    for (const { enemy, priority } of this.rankedTargets) {
      if (
        !probes.isInRange({
          unit: tower,
          target: enemy.unit,
          range: GuardTowerAttackRange,
        })
      ) {
        continue;
      }

      if (enemy.unit === currentAttackTarget && towerBusy) {
        return;
      }

      if (probes.tryAttack({ unit: tower, target: enemy.unit })) {
        this.attackTargets.set(tower, enemy.unit);
        recorder.note({
          message: `Guard Tower attacks ${TARGET_PRIORITY[priority]} target with ${Math.floor(enemy.life)} life.`,
        });
        return;
      }
    }

    this.attackTargets.delete(tower);
  }

  private forgetLostTowers({ beliefs }: TowerTargetingForgetLostTowersArgs) {
    const lostTowers: UnitId[] = [];

    for (const tower of this.attackTargets.keys()) {
      if (!beliefs.self.guardTowers.includes(tower)) {
        lostTowers.push(tower);
      }
    }

    for (const tower of lostTowers) {
      this.attackTargets.delete(tower);
    }
  }
}

const PassSeconds = 1;
// Not verified in-game that IsUnitInRange matches the tower's own reach.
const GuardTowerAttackRange = 700;
