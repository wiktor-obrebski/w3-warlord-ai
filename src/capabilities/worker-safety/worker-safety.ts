import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3MathApi from "@lib/warcraft3-api/math";
import { debug } from "../../debug";
import { Point, VisibleEnemy } from "../../perception/world-state";
import {
  isWalkable,
  ObservedWorker,
  WorkerSafetyPerception,
} from "./perception";

const FLEE_ROUND_DISTANCE = 300;
const SAFE_AFTER_ATTACK_SECONDS = 2;
// Not tuned in-game.
const THREAT_RADIUS = 1000;
const FLEE_DESTINATION_REACHED_DISTANCE = 32;
const FLEE_ANGLE_STEP = Math.PI / 6;
// Alternating to either side of straight away, ending straight back.
const FLEE_ANGLE_OFFSETS = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6].map(
  (step) => step * FLEE_ANGLE_STEP,
);

export enum WorkerSafetyStatus {
  Fleeing,
  // No longer fleeing, but not yet unattacked for long enough to be safe.
  Recovering,
  Safe,
}

interface WorkerSafetyRecord {
  worker: W3UnitApi.unit;
  lastAttackedAt: number;
  // Set for the duration of one flee round.
  fleeDestination?: Point;
}

/** Workers recently attacked; any worker without a record is safe. */
export interface WorkerSafety {
  records: WorkerSafetyRecord[];
}

export function createWorkerSafety(): WorkerSafety {
  return { records: [] };
}

/**
 * Attacked workers run away from the nearby enemy force. While a worker is
 * not safe, it belongs to this capability: other code must not order it.
 */
export function updateWorkerSafety(
  safety: WorkerSafety,
  perception: WorkerSafetyPerception,
) {
  for (const worker of perception.workers) {
    protectWorker(worker, perception, safety);
  }

  safety.records = safety.records.filter(
    (record) =>
      perception.workers.some((worker) => worker.unit === record.worker) &&
      statusOf(record, perception.time) !== WorkerSafetyStatus.Safe,
  );
}

export function workerSafetyStatus(
  safety: WorkerSafety,
  worker: W3UnitApi.unit,
  now: number,
): WorkerSafetyStatus {
  const record = safety.records.find((entry) => entry.worker === worker);

  return record ? statusOf(record, now) : WorkerSafetyStatus.Safe;
}

export function isWorkerSafe(
  safety: WorkerSafety,
  worker: W3UnitApi.unit,
  now: number,
): boolean {
  return workerSafetyStatus(safety, worker, now) === WorkerSafetyStatus.Safe;
}

function statusOf(record: WorkerSafetyRecord, now: number): WorkerSafetyStatus {
  if (record.fleeDestination) {
    return WorkerSafetyStatus.Fleeing;
  }

  return now - record.lastAttackedAt >= SAFE_AFTER_ATTACK_SECONDS
    ? WorkerSafetyStatus.Safe
    : WorkerSafetyStatus.Recovering;
}

// Each flee round runs a fixed distance to a destination kept until the
// round ends, so the worker is not turned around on every update as the
// enemies move.
function protectWorker(
  worker: ObservedWorker,
  perception: WorkerSafetyPerception,
  safety: WorkerSafety,
) {
  let record = safety.records.find((entry) => entry.worker === worker.unit);

  if (worker.isAttacked && record) {
    record.lastAttackedAt = perception.time;
  } else if (worker.isAttacked) {
    record = { worker: worker.unit, lastAttackedAt: perception.time };
    safety.records.push(record);
  }

  if (!record) {
    return;
  }

  if (record.fleeDestination) {
    if (!fleeRoundFinished(worker, record.fleeDestination)) {
      return;
    }

    record.fleeDestination = undefined;

    if (!worker.isAttacked) {
      debug("Worker safety: worker is no longer attacked.");
    }
  }

  if (worker.isAttacked) {
    startFleeRound(worker, perception, record);
  }
}

// An unreachable destination ends the move short of it, leaving the worker
// idle.
function fleeRoundFinished(worker: ObservedWorker, destination: Point): boolean {
  return (
    worker.isIdle ||
    distanceBetween(worker.position, destination) <=
      FLEE_DESTINATION_REACHED_DISTANCE
  );
}

function startFleeRound(
  worker: ObservedWorker,
  perception: WorkerSafetyPerception,
  record: WorkerSafetyRecord,
) {
  const nearby = nearbyThreats(worker.position, perception);
  const attackers = perception.visibleEnemies.filter(
    (enemy) => enemy.attackTarget === worker.unit,
  );
  const reference = nearby.length > 0 ? nearby : attackers;
  const awayAngle =
    reference.length > 0
      ? angleAwayFrom(averagePosition(reference), worker.position)
      : undefined;
  const destination = fleeDestination(worker.position, awayAngle);

  if (
    W3UnitApi.IssuePointOrder(worker.unit, "move", destination.x, destination.y)
  ) {
    record.fleeDestination = destination;
    debug(
      `Worker safety: attacked worker flees from ${nearby.length} nearby enemies.`,
    );
  } else {
    debug("Worker safety: flee order rejected.");
  }
}

// A worker standing still is easily killed, so it always runs somewhere.
// Directions closest to straight away come first; without a direction to
// run from, e.g. when the attacker is not visible, the search starts from a
// random one. When no direction is walkable, a random one is taken anyway
// and Warcraft moves the worker as close to it as it can.
function fleeDestination(from: Point, awayAngle: number | undefined): Point {
  const preferredAngle = awayAngle ?? W3MathApi.GetRandomReal(0, Math.PI * 2);

  for (const offset of FLEE_ANGLE_OFFSETS) {
    const candidate = pointAt(from, preferredAngle + offset, FLEE_ROUND_DISTANCE);

    if (isWalkable(candidate)) {
      if (offset !== 0) {
        debug(
          `Worker safety: straight away is blocked; fleeing ${Math.floor((offset * 180) / Math.PI)} degrees off.`,
        );
      }

      return candidate;
    }
  }

  debug("Worker safety: no walkable flee direction; fleeing at random.");

  return pointAt(
    from,
    W3MathApi.GetRandomReal(0, Math.PI * 2),
    FLEE_ROUND_DISTANCE,
  );
}

// The enemy force fighting near the worker: combat units and the Ancients
// that walk into the fight.
function nearbyThreats(
  position: Point,
  perception: WorkerSafetyPerception,
): VisibleEnemy[] {
  return perception.visibleEnemies.filter(
    (enemy) =>
      (enemy.isUprootedAncient ||
        (!enemy.isStructure &&
          !enemy.isWorker &&
          (enemy.isMelee || enemy.isRanged))) &&
      distanceBetween(position, enemy.position) <= THREAT_RADIUS,
  );
}

function averagePosition(enemies: VisibleEnemy[]): Point {
  let x = 0;
  let y = 0;

  for (const enemy of enemies) {
    x += enemy.position.x;
    y += enemy.position.y;
  }

  return { x: x / enemies.length, y: y / enemies.length };
}

// Undefined when standing on the threat, which gives no direction.
function angleAwayFrom(threat: Point, from: Point): number | undefined {
  if (distanceBetween(threat, from) === 0) {
    return undefined;
  }

  return Math.atan2(from.y - threat.y, from.x - threat.x);
}

function pointAt(from: Point, angle: number, distance: number): Point {
  return {
    x: from.x + Math.cos(angle) * distance,
    y: from.y + Math.sin(angle) * distance,
  };
}

function distanceBetween(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
