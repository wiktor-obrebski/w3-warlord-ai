import { CommonBeliefs, VisibleEnemy } from '../../beliefs/common.beliefs';
import { recentAttackTarget } from '../../beliefs/common.assessments';

export { TARGET_PRIORITY, type RankedTarget, rankTowerTargets };

enum TARGET_PRIORITY {
  MELEE_ATTACKING_PEASANT = 1,
  RANGED_ATTACKING_PEASANT,
  SIEGE_ATTACKING_TOWER,
  MELEE_ATTACKING_TOWER,
  RANGED_ATTACKING_TOWER,
  SIEGE,
  RANGED,
  MELEE,
  WORKER,
  BUILDING,
}

interface RankedTarget {
  readonly enemy: VisibleEnemy;
  readonly priority: TARGET_PRIORITY;
}

interface RankTowerTargetsArgs {
  beliefs: Readonly<CommonBeliefs>;
}

/**
 * The visible enemies worth a Guard Tower's fire, best first: by priority,
 * then by lowest life.
 */
function rankTowerTargets({ beliefs }: RankTowerTargetsArgs): RankedTarget[] {
  const ranked: RankedTarget[] = [];

  for (const enemy of beliefs.visibleEnemies) {
    const priority = targetPriority({ enemy, beliefs });

    if (priority !== undefined) {
      ranked.push({ enemy, priority });
    }
  }

  ranked.sort((a, b) =>
    a.priority === b.priority
      ? a.enemy.life - b.enemy.life
      : a.priority - b.priority
  );

  return ranked;
}

interface TargetPriorityArgs {
  enemy: VisibleEnemy;
  beliefs: Readonly<CommonBeliefs>;
}

// Melee, ranged and siege are independent properties, so the first matching
// rule decides. Workers rank only as workers, whatever they attack. Buildings
// that can attack, such as Ancients, only outrank other buildings while they
// attack a tower.
function targetPriority({
  enemy,
  beliefs,
}: TargetPriorityArgs): TARGET_PRIORITY | undefined {
  if (enemy.isWorker) {
    return TARGET_PRIORITY.WORKER;
  }

  const attackTarget = recentAttackTarget({ beliefs, attacker: enemy.unit });
  const attacksPeasant =
    attackTarget !== undefined && beliefs.peasants.includes(attackTarget);
  const attacksTower =
    attackTarget !== undefined && beliefs.guardTowers.includes(attackTarget);
  const towerAttackPriority = attacksTower
    ? attackingTowerPriority({ enemy })
    : undefined;

  if (enemy.isStructure) {
    return towerAttackPriority ?? TARGET_PRIORITY.BUILDING;
  }

  if (enemy.isMelee && attacksPeasant) {
    return TARGET_PRIORITY.MELEE_ATTACKING_PEASANT;
  }
  if (enemy.isRanged && attacksPeasant) {
    return TARGET_PRIORITY.RANGED_ATTACKING_PEASANT;
  }
  if (towerAttackPriority !== undefined) {
    return towerAttackPriority;
  }
  if (enemy.isSiege) {
    return TARGET_PRIORITY.SIEGE;
  }
  if (enemy.isRanged) {
    return TARGET_PRIORITY.RANGED;
  }
  if (enemy.isMelee) {
    return TARGET_PRIORITY.MELEE;
  }

  return undefined;
}

interface AttackingTowerPriorityArgs {
  enemy: VisibleEnemy;
}

function attackingTowerPriority({
  enemy,
}: AttackingTowerPriorityArgs): TARGET_PRIORITY | undefined {
  if (enemy.isSiege) {
    return TARGET_PRIORITY.SIEGE_ATTACKING_TOWER;
  }
  if (enemy.isMelee) {
    return TARGET_PRIORITY.MELEE_ATTACKING_TOWER;
  }
  if (enemy.isRanged) {
    return TARGET_PRIORITY.RANGED_ATTACKING_TOWER;
  }

  return undefined;
}
