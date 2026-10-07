import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { BeliefContainer, Controller } from "@lib/bdi";
import { debug } from "../../debug";
import {
  CommonBeliefModel,
  CommonBeliefs,
  recentAttackTarget,
  VisibleEnemy,
} from "../../beliefs/common.beliefs";

// Not verified in-game that IsUnitInRange matches the tower's own reach.
const GUARD_TOWER_ATTACK_RANGE = 700;

enum TargetPriority {
  MeleeAttackingPeasant = 1,
  RangedAttackingPeasant,
  SiegeAttackingTower,
  MeleeAttackingTower,
  RangedAttackingTower,
  Siege,
  Ranged,
  Melee,
  Worker,
  Building,
}

interface RankedTarget {
  enemy: VisibleEnemy;
  priority: TargetPriority;
}

interface TowerTarget {
  tower: W3UnitApi.unit;
  target: W3UnitApi.unit;
}

/**
 * Targets are ranked once for all Guard Towers; each tower then attacks the
 * best one within its own range, so overlapping towers focus the same target.
 */
export class TowerTargetSelectionController
  implements Controller<BeliefContainer>
{
  private readonly common: CommonBeliefModel;
  // The last attack order of each Guard Tower, so it is not re-issued while
  // the tower is still carrying it out.
  private towerTargets: TowerTarget[] = [];

  public constructor(common: CommonBeliefModel) {
    this.common = common;
  }

  public update(container: Readonly<BeliefContainer>) {
    const beliefs = container.get(this.common);
    const rankedTargets = rankTargets(beliefs);

    this.towerTargets = this.towerTargets.filter((entry) =>
      beliefs.guardTowers.includes(entry.tower),
    );

    for (const tower of beliefs.guardTowers) {
      this.attackBestTargetInRange(tower, rankedTargets, beliefs);
    }
  }

  // Re-issuing an attack the tower is already carrying out could restart its
  // attack, so the order is only issued when the target changes or the tower
  // has dropped it. A rejected target is skipped in favour of the next one.
  private attackBestTargetInRange(
    tower: W3UnitApi.unit,
    rankedTargets: RankedTarget[],
    beliefs: Readonly<CommonBeliefs>,
  ) {
    const currentTarget = this.towerTargets.find(
      (entry) => entry.tower === tower,
    )?.target;
    const towerBusy = !beliefs.idleUnits.includes(tower);

    for (const { enemy, priority } of rankedTargets) {
      if (
        !W3UnitApi.IsUnitInRange(tower, enemy.unit, GUARD_TOWER_ATTACK_RANGE)
      ) {
        continue;
      }

      if (enemy.unit === currentTarget && towerBusy) {
        return;
      }

      if (W3UnitApi.IssueTargetOrder(tower, "attack", enemy.unit)) {
        this.rememberTowerTarget(tower, enemy.unit);
        debug(
          `Operate towers: Guard Tower attacks ${TargetPriority[priority]} target with ${Math.floor(enemy.life)} life.`,
        );
        return;
      }
    }

    this.forgetTowerTarget(tower);
  }

  private rememberTowerTarget(tower: W3UnitApi.unit, target: W3UnitApi.unit) {
    this.forgetTowerTarget(tower);
    this.towerTargets.push({ tower, target });
  }

  private forgetTowerTarget(tower: W3UnitApi.unit) {
    this.towerTargets = this.towerTargets.filter(
      (entry) => entry.tower !== tower,
    );
  }
}

function rankTargets(beliefs: Readonly<CommonBeliefs>): RankedTarget[] {
  const ranked: RankedTarget[] = [];

  for (const enemy of beliefs.visibleEnemies) {
    const priority = targetPriority(enemy, beliefs);

    if (priority !== undefined) {
      ranked.push({ enemy, priority });
    }
  }

  ranked.sort((a, b) =>
    a.priority === b.priority
      ? a.enemy.life - b.enemy.life
      : a.priority - b.priority,
  );

  return ranked;
}

// Melee, ranged and siege are independent properties, so the first matching
// rule decides. Workers rank only as workers, whatever they attack. Buildings
// that can attack, such as Ancients, only outrank other buildings while they
// attack a tower.
function targetPriority(
  enemy: VisibleEnemy,
  beliefs: Readonly<CommonBeliefs>,
): TargetPriority | undefined {
  if (enemy.isWorker) {
    return TargetPriority.Worker;
  }

  const attackTarget = recentAttackTarget(beliefs, enemy.unit);
  const attacksPeasant =
    attackTarget !== undefined && beliefs.peasants.includes(attackTarget);
  const attacksTower =
    attackTarget !== undefined && beliefs.guardTowers.includes(attackTarget);
  const towerAttackPriority = attacksTower
    ? attackingTowerPriority(enemy)
    : undefined;

  if (enemy.isStructure) {
    return towerAttackPriority ?? TargetPriority.Building;
  }

  if (enemy.isMelee && attacksPeasant) {
    return TargetPriority.MeleeAttackingPeasant;
  }
  if (enemy.isRanged && attacksPeasant) {
    return TargetPriority.RangedAttackingPeasant;
  }
  if (towerAttackPriority !== undefined) {
    return towerAttackPriority;
  }
  if (enemy.isSiege) {
    return TargetPriority.Siege;
  }
  if (enemy.isRanged) {
    return TargetPriority.Ranged;
  }
  if (enemy.isMelee) {
    return TargetPriority.Melee;
  }

  return undefined;
}

function attackingTowerPriority(
  enemy: VisibleEnemy,
): TargetPriority | undefined {
  if (enemy.isSiege) {
    return TargetPriority.SiegeAttackingTower;
  }
  if (enemy.isMelee) {
    return TargetPriority.MeleeAttackingTower;
  }
  if (enemy.isRanged) {
    return TargetPriority.RangedAttackingTower;
  }

  return undefined;
}
