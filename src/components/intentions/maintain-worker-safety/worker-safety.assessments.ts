import { Point, Vector } from '@lib/math';
import type { UnitId } from '../../../contracts/ids';
import type { OwnUnit, VisibleEnemy } from '../../../contracts/world';
import type { Beliefs } from '../../../contracts/beliefs';

export { nearbyThreats, threatCenter, isRecentlyAttacked };

interface NearbyThreatsArgs {
  beliefs: Beliefs;
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
  return beliefs.enemy.visibleUnits.filter(
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
  beliefs: Beliefs;
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
      : beliefs.enemy.visibleUnits.filter(
          (enemy) =>
            recentAttackTarget({ beliefs, attacker: enemy.unit }) ===
            worker.unit
        );

  return reference.length > 0
    ? averagePosition({ enemies: reference })
    : undefined;
}

interface IsRecentlyAttackedArgs {
  beliefs: Beliefs;
  attackedUnit: UnitId;
}

/** Whether any attacker recently started an attack on the bot's unit. */
function isRecentlyAttacked({
  beliefs,
  attackedUnit,
}: IsRecentlyAttackedArgs): boolean {
  return beliefs.self.recentAttacks.some(
    (attack) => attack.attackedUnit === attackedUnit
  );
}

// Not tuned in-game.
const ThreatRadius = 1000;

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

interface RecentAttackTargetArgs {
  beliefs: Beliefs;
  attacker: UnitId;
}

/** The bot's unit the attacker recently started an attack on, if any. */
function recentAttackTarget({
  beliefs,
  attacker,
}: RecentAttackTargetArgs): UnitId | undefined {
  return beliefs.self.recentAttacks.find(
    (attack) => attack.attacker === attacker
  )?.attackedUnit;
}
