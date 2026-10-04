import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { debug } from "../../../debug";
import { VisibleEnemy, WorldState } from "../../../perception/world-state";
import { TowerRushContext } from "../tower-rush-context";
import { maintainTowers } from "../tower-repair";

// Not verified in-game that IsUnitInRange matches the tower's own reach.
const GUARD_TOWER_ATTACK_RANGE = 700;

enum TargetPriority {
  MeleeAttackingForwardWorker = 1,
  RangedAttackingForwardWorker,
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

// Terminal phase: the forward Peasants keep the towers repaired and the
// towers pick their own targets.
export function updateHoldingPosition(
  world: WorldState,
  context: TowerRushContext,
) {
  maintainTowers(world, context);
  controlTowerAggression(world, context);
}

// Targets are ranked once for all towers; each tower then attacks the best
// one within its own range, so overlapping towers focus the same target.
function controlTowerAggression(world: WorldState, context: TowerRushContext) {
  const rankedTargets = rankTargets(world, context);

  context.towerTargets = context.towerTargets.filter((entry) =>
    world.guardTowers.includes(entry.tower),
  );

  for (const tower of world.guardTowers) {
    attackBestTargetInRange(tower, rankedTargets, world, context);
  }
}

function rankTargets(
  world: WorldState,
  context: TowerRushContext,
): RankedTarget[] {
  const ranked: RankedTarget[] = [];

  for (const enemy of world.visibleEnemies) {
    const priority = targetPriority(enemy, world, context);

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
// rule decides. Workers rank only as workers, whatever they attack.
function targetPriority(
  enemy: VisibleEnemy,
  world: WorldState,
  context: TowerRushContext,
): TargetPriority | undefined {
  if (enemy.isWorker) {
    return TargetPriority.Worker;
  }

  const { attackTarget } = enemy;
  const attacksForwardWorker =
    attackTarget !== undefined && context.forwardWorkers.includes(attackTarget);
  const attacksTower =
    attackTarget !== undefined && world.guardTowers.includes(attackTarget);

  if (enemy.isMelee && attacksForwardWorker) {
    return TargetPriority.MeleeAttackingForwardWorker;
  }
  if (enemy.isRanged && attacksForwardWorker) {
    return TargetPriority.RangedAttackingForwardWorker;
  }
  if (enemy.isSiege && attacksTower) {
    return TargetPriority.SiegeAttackingTower;
  }
  if (enemy.isMelee && attacksTower) {
    return TargetPriority.MeleeAttackingTower;
  }
  if (enemy.isRanged && attacksTower) {
    return TargetPriority.RangedAttackingTower;
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
  if (enemy.isStructure) {
    return TargetPriority.Building;
  }

  return undefined;
}

// Re-issuing an attack the tower is already carrying out could restart its
// attack, so the order is only issued when the target changes or the tower
// has dropped it. A rejected target is skipped in favour of the next one.
function attackBestTargetInRange(
  tower: W3UnitApi.unit,
  rankedTargets: RankedTarget[],
  world: WorldState,
  context: TowerRushContext,
) {
  const currentTarget = context.towerTargets.find(
    (entry) => entry.tower === tower,
  )?.target;
  const towerBusy = !world.idleUnits.includes(tower);

  for (const { enemy, priority } of rankedTargets) {
    if (!W3UnitApi.IsUnitInRange(tower, enemy.unit, GUARD_TOWER_ATTACK_RANGE)) {
      continue;
    }

    if (enemy.unit === currentTarget && towerBusy) {
      return;
    }

    if (W3UnitApi.IssueTargetOrder(tower, "attack", enemy.unit)) {
      rememberTowerTarget(tower, enemy.unit, context);
      debug(
        `Tower rush: Guard Tower attacks ${TargetPriority[priority]} target with ${Math.floor(enemy.life)} life.`,
      );
      return;
    }
  }

  forgetTowerTarget(tower, context);
}

function rememberTowerTarget(
  tower: W3UnitApi.unit,
  target: W3UnitApi.unit,
  context: TowerRushContext,
) {
  forgetTowerTarget(tower, context);
  context.towerTargets.push({ tower, target });
}

function forgetTowerTarget(tower: W3UnitApi.unit, context: TowerRushContext) {
  context.towerTargets = context.towerTargets.filter(
    (entry) => entry.tower !== tower,
  );
}
