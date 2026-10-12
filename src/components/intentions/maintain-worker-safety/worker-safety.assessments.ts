import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { Point, Vector } from '@lib/math';
import type { OwnUnit, VisibleEnemy } from '../../../contracts/world';
import type { MaintainWorkerSafetyCommonBeliefs } from './maintain-worker-safety.common-beliefs';
import type { WorkerSafetyBeliefs } from './worker-safety.beliefs';

export {
  needsAttackProtection,
  nearbyThreats,
  threatCenter,
  isRecentlyAttacked,
};

// Not tuned in-game.
const ThreatRadius = 1000;

interface NeedsAttackProtectionArgs {
  beliefs: Readonly<WorkerSafetyBeliefs>;
  worker: W3UnitApi.unit;
}

/**
 * Whether the worker is attacked, or was attacked too recently to be safe
 * again.
 */
function needsAttackProtection({
  beliefs,
  worker,
}: NeedsAttackProtectionArgs): boolean {
  return beliefs.lastAttackedAt.has(worker);
}

interface NearbyThreatsArgs {
  beliefs: Readonly<MaintainWorkerSafetyCommonBeliefs>;
  position: Point;
}

/**
 * The enemy force fighting near the position: combat units and the Ancients
 * that walk into the fight.
 */
function nearbyThreats({
  beliefs,
  position,
}: NearbyThreatsArgs): VisibleEnemy[] {
  return beliefs.visibleEnemies.filter(
    (enemy) =>
      (enemy.isUprootedAncient ||
        (!enemy.isStructure &&
          !enemy.isWorker &&
          (enemy.isMelee || enemy.isRanged))) &&
      new Vector({ start: position, end: enemy.position }).length <=
        ThreatRadius
  );
}

interface ThreatCenterArgs {
  beliefs: Readonly<MaintainWorkerSafetyCommonBeliefs>;
  worker: OwnUnit;
}

/**
 * Where the threat to the worker comes from: the center of the nearby enemy
 * force, or of its visible attackers when no force is near. Undefined when
 * neither is visible.
 */
function threatCenter({
  beliefs,
  worker,
}: ThreatCenterArgs): Point | undefined {
  const nearby = nearbyThreats({ beliefs, position: worker.position });
  const reference =
    nearby.length > 0
      ? nearby
      : beliefs.visibleEnemies.filter(
          (enemy) =>
            recentAttackTarget({ beliefs, attacker: enemy.unit }) ===
            worker.unit
        );

  return reference.length > 0
    ? averagePosition({ enemies: reference })
    : undefined;
}

interface AveragePositionArgs {
  enemies: readonly VisibleEnemy[];
}

function averagePosition({ enemies }: AveragePositionArgs): Point {
  const origin = new Point({ x: 0, y: 0 });
  let sum = new Vector({ x: 0, y: 0 });

  for (const enemy of enemies) {
    sum = sum.add({
      vector: new Vector({ start: origin, end: enemy.position }),
    });
  }

  return origin.translate({
    vector: sum.multiply({ scalar: 1 / enemies.length }),
  });
}

interface IsRecentlyAttackedArgs {
  beliefs: Readonly<MaintainWorkerSafetyCommonBeliefs>;
  attackedUnit: W3UnitApi.unit;
}

/** Whether any attacker recently started an attack on the bot's unit. */
function isRecentlyAttacked({
  beliefs,
  attackedUnit,
}: IsRecentlyAttackedArgs): boolean {
  return beliefs.recentAttacks.some(
    (attack) => attack.attackedUnit === attackedUnit
  );
}

interface RecentAttackTargetArgs {
  beliefs: Readonly<MaintainWorkerSafetyCommonBeliefs>;
  attacker: W3UnitApi.unit;
}

/** The bot's unit the attacker recently started an attack on, if any. */
function recentAttackTarget({
  beliefs,
  attacker,
}: RecentAttackTargetArgs): W3UnitApi.unit | undefined {
  return beliefs.recentAttacks.find((attack) => attack.attacker === attacker)
    ?.attackedUnit;
}
