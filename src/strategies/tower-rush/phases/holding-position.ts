import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { debug } from "../../../debug";
import { VisibleEnemy, WorldState } from "../../../perception/world-state";
import { TowerRushContext } from "../tower-rush-context";
import {
  forgetSentToSafety,
  hideBehindClosestTower,
  isAvailableForwardPeasant,
} from "../forward-workers";

// A repair starts below the start fraction and is not interrupted before the
// switch fraction; above it, a tower below the start fraction takes over,
// otherwise the repair goes on to full life.
const REPAIR_START_LIFE_FRACTION = 0.6;
const REPAIR_SWITCH_LIFE_FRACTION = 0.8;
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

function maintainTowers(world: WorldState, context: TowerRushContext) {
  const enemyMain = world.enemyStartPosition;

  if (!enemyMain) {
    throw new Error("Tower rush: enemy start position not found.");
  }

  const previousTarget = context.repairTarget;
  const repairTarget = chooseRepairTarget(world, previousTarget);
  const targetChanged = repairTarget !== previousTarget;
  context.repairTarget = repairTarget;

  if (targetChanged) {
    debug(
      repairTarget
        ? `Tower rush: repairing a tower at ${Math.floor(lifeFraction(repairTarget) * 100)}% life.`
        : "Tower rush: no tower needs repair.",
    );
  }

  for (const worker of context.forwardWorkers) {
    if (!world.peasants.includes(worker)) {
      continue;
    }

    if (repairTarget) {
      if (targetChanged || !world.repairingUnits.includes(worker)) {
        orderRepair(worker, repairTarget, context);
      }
    } else if (
      isAvailableForwardPeasant(worker, world) &&
      !context.forwardWorkersSentToSafety.includes(worker)
    ) {
      hideBehindClosestTower(worker, world.guardTowers, enemyMain, context);
    }
  }
}

function chooseRepairTarget(
  world: WorldState,
  current: W3UnitApi.unit | undefined,
): W3UnitApi.unit | undefined {
  const currentAlive = current !== undefined && world.guardTowers.includes(current);

  if (currentAlive && lifeFraction(current) < REPAIR_SWITCH_LIFE_FRACTION) {
    return current;
  }

  const mostDamaged = mostDamagedTower(
    world.guardTowers.filter(
      (tower) =>
        tower !== current && lifeFraction(tower) < REPAIR_START_LIFE_FRACTION,
    ),
  );

  if (mostDamaged) {
    return mostDamaged;
  }

  return currentAlive && lifeFraction(current) < 1 ? current : undefined;
}

function mostDamagedTower(
  towers: W3UnitApi.unit[],
): W3UnitApi.unit | undefined {
  let mostDamaged: W3UnitApi.unit | undefined;

  for (const tower of towers) {
    if (!mostDamaged || lifeFraction(tower) < lifeFraction(mostDamaged)) {
      mostDamaged = tower;
    }
  }

  return mostDamaged;
}

function orderRepair(
  worker: W3UnitApi.unit,
  tower: W3UnitApi.unit,
  context: TowerRushContext,
) {
  if (W3UnitApi.IssueTargetOrder(worker, "repair", tower)) {
    forgetSentToSafety(worker, context);
  } else {
    debug("Tower rush: repair order rejected.");
  }
}

function lifeFraction(unit: W3UnitApi.unit): number {
  return (
    W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_LIFE) /
    W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_MAX_LIFE)
  );
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
// rule decides.
function targetPriority(
  enemy: VisibleEnemy,
  world: WorldState,
  context: TowerRushContext,
): TargetPriority | undefined {
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
