import { CommonBeliefs, VisibleEnemy } from "../../beliefs/common.beliefs";
import { recentAttackTarget } from "../../beliefs/common.assessments";

export enum TargetPriority {
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

export interface RankedTarget {
  readonly enemy: VisibleEnemy;
  readonly priority: TargetPriority;
}

/**
 * The visible enemies worth a Guard Tower's fire, best first: by priority,
 * then by lowest life.
 */
export function rankTowerTargets(
  beliefs: Readonly<CommonBeliefs>,
): RankedTarget[] {
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
