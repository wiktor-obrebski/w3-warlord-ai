import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { Point, Vector } from "@lib/math";
import {
  CommonBeliefs,
  OwnUnit,
  VisibleEnemy,
} from "../../beliefs/common.beliefs";
import { recentAttackTarget } from "../../beliefs/common.assessments";
import { WorkerSafetyBeliefs } from "./worker-safety.beliefs";

// Not tuned in-game.
const THREAT_RADIUS = 1000;

/** Whether the worker was attacked too recently to be safe. */
export function isRecoveringFromAttack(
  beliefs: Readonly<WorkerSafetyBeliefs>,
  worker: W3UnitApi.unit,
): boolean {
  return beliefs.lastAttackedAt.has(worker);
}

/**
 * The enemy force fighting near the position: combat units and the Ancients
 * that walk into the fight.
 */
export function nearbyThreats(
  beliefs: Readonly<CommonBeliefs>,
  position: Point,
): VisibleEnemy[] {
  return beliefs.visibleEnemies.filter(
    (enemy) =>
      (enemy.isUprootedAncient ||
        (!enemy.isStructure &&
          !enemy.isWorker &&
          (enemy.isMelee || enemy.isRanged))) &&
      new Vector(position, enemy.position).length <= THREAT_RADIUS,
  );
}

/**
 * Where the threat to the worker comes from: the center of the nearby enemy
 * force, or of its visible attackers when no force is near. Undefined when
 * neither is visible.
 */
export function threatCenter(
  beliefs: Readonly<CommonBeliefs>,
  worker: OwnUnit,
): Point | undefined {
  const nearby = nearbyThreats(beliefs, worker.position);
  const reference =
    nearby.length > 0
      ? nearby
      : beliefs.visibleEnemies.filter(
          (enemy) => recentAttackTarget(beliefs, enemy.unit) === worker.unit,
        );

  return reference.length > 0 ? averagePosition(reference) : undefined;
}

function averagePosition(enemies: readonly VisibleEnemy[]): Point {
  const origin = new Point(0, 0);
  let sum = new Vector(0, 0);

  for (const enemy of enemies) {
    sum = sum.add(new Vector(origin, enemy.position));
  }

  return origin.translate(sum.multiply(1 / enemies.length));
}
