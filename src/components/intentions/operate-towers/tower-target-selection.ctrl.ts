import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { debug } from '../../../debug';
import type { ActorControl } from '../../../contracts/actor-control';
import {
  AssembledWarlordComponent,
  WarlordBeliefs,
  WarlordController,
} from '../../../execution';
import { CommonBeliefs } from '../../../beliefs/common.beliefs';
import {
  RankedTarget,
  rankTowerTargets,
  TARGET_PRIORITY,
} from './operate-towers.assessments';

export { assembleTowerTargetSelectionController };

// Not verified in-game that IsUnitInRange matches the tower's own reach.
const GuardTowerAttackRange = 700;

interface TowerTarget {
  tower: W3UnitApi.unit;
  attackTarget: W3UnitApi.unit;
}

interface TowerTargetSelectionControllerUpdateArgs {
  beliefs: WarlordBeliefs;
  actorControl: ActorControl;
}

interface TowerTargetSelectionControllerAttackBestTargetInRangeArgs {
  tower: W3UnitApi.unit;
  rankedTargets: readonly RankedTarget[];
  beliefs: Readonly<CommonBeliefs>;
}

interface TowerTargetSelectionControllerRememberTowerTargetArgs {
  tower: W3UnitApi.unit;
  attackTarget: W3UnitApi.unit;
}

/**
 * Targets are ranked once for all Guard Towers; each tower then attacks the
 * best one within its own range, so overlapping towers focus the same target.
 */
class TowerTargetSelectionController implements WarlordController {
  // The last attack order of each Guard Tower, so it is not re-issued while
  // the tower is still carrying it out.
  private towerTargets: TowerTarget[] = [];

  public update({
    beliefs: { commonBeliefs: beliefs },
    actorControl,
  }: TowerTargetSelectionControllerUpdateArgs) {
    const rankedTargets = rankTowerTargets({ beliefs });

    this.towerTargets = this.towerTargets.filter((towerTarget) =>
      beliefs.guardTowers.includes(towerTarget.tower)
    );

    for (const tower of beliefs.guardTowers) {
      if (actorControl.request({ actor: tower, request: 'normal' })) {
        this.attackBestTargetInRange({ tower, rankedTargets, beliefs });
      }
    }
  }

  // Re-issuing an attack the tower is already carrying out could restart its
  // attack, so the order is only issued when the target changes or the tower
  // has dropped it. A rejected target is skipped in favour of the next one.
  private attackBestTargetInRange({
    tower,
    rankedTargets,
    beliefs,
  }: TowerTargetSelectionControllerAttackBestTargetInRangeArgs) {
    const currentAttackTarget = this.towerTargets.find(
      (towerTarget) => towerTarget.tower === tower
    )?.attackTarget;
    const towerBusy = !beliefs.idleUnits.includes(tower);

    for (const { enemy, priority } of rankedTargets) {
      if (!W3UnitApi.IsUnitInRange(tower, enemy.unit, GuardTowerAttackRange)) {
        continue;
      }

      if (enemy.unit === currentAttackTarget && towerBusy) {
        return;
      }

      if (W3UnitApi.IssueTargetOrder(tower, 'attack', enemy.unit)) {
        this.rememberTowerTarget({ tower, attackTarget: enemy.unit });
        debug({
          message: `Operate towers: Guard Tower attacks ${TARGET_PRIORITY[priority]} target with ${Math.floor(enemy.life)} life.`,
        });
        return;
      }
    }

    this.forgetTowerTarget({ tower });
  }

  private rememberTowerTarget({
    tower,
    attackTarget,
  }: TowerTargetSelectionControllerRememberTowerTargetArgs) {
    this.forgetTowerTarget({ tower });
    this.towerTargets.push({ tower, attackTarget });
  }

  private forgetTowerTarget({ tower }: { tower: W3UnitApi.unit }) {
    this.towerTargets = this.towerTargets.filter(
      (towerTarget) => towerTarget.tower !== tower
    );
  }
}

function assembleTowerTargetSelectionController(): AssembledWarlordComponent<WarlordController> {
  return { component: new TowerTargetSelectionController(), children: [] };
}
