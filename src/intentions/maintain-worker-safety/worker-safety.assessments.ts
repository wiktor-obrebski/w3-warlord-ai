import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { Point, Vector } from '@lib/math';
import {
  CommonBeliefs,
  OwnUnit,
  VisibleEnemy,
} from '../../beliefs/common.beliefs';
import { recentAttackTarget } from '../../beliefs/common.assessments';
import { WorkerSafetyBeliefs } from './worker-safety.beliefs';

export { needsAttackProtection, nearbyThreats, threatCenter };

// Not tuned in-game.
const ThreatRadius = 1000;

/**
 * Whether the worker is attacked, or was attacked too recently to be safe
 * again.
 */
function needsAttackProtection({
  beliefs,
  worker,
}: {
  beliefs: Readonly<WorkerSafetyBeliefs>;
  worker: W3UnitApi.unit;
}): boolean {
  return beliefs.lastAttackedAt.has(worker);
}

/**
 * The enemy force fighting near the position: combat units and the Ancients
 * that walk into the fight.
 */
function nearbyThreats({
  beliefs,
  position,
}: {
  beliefs: Readonly<CommonBeliefs>;
  position: Point;
}): VisibleEnemy[] {
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

/**
 * Where the threat to the worker comes from: the center of the nearby enemy
 * force, or of its visible attackers when no force is near. Undefined when
 * neither is visible.
 */
function threatCenter({
  beliefs,
  worker,
}: {
  beliefs: Readonly<CommonBeliefs>;
  worker: OwnUnit;
}): Point | undefined {
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

function averagePosition({
  enemies,
}: {
  enemies: readonly VisibleEnemy[];
}): Point {
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
