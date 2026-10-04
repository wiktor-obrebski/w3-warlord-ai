import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3MathApi from "@lib/warcraft3-api/math";
import { debug } from "../../debug";
import { Point, Vector } from "@lib/math";
import { VisibleEnemy } from "../../perception/world-state";
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

interface FleeRound {
  origin: Point;
  destination: Point;
}

interface WorkerSafetyRecord {
  worker: W3UnitApi.unit;
  lastAttackedAt: number;
  fleeRound?: FleeRound;
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
  if (record.fleeRound) {
    return WorkerSafetyStatus.Fleeing;
  }

  return now - record.lastAttackedAt >= SAFE_AFTER_ATTACK_SECONDS
    ? WorkerSafetyStatus.Safe
    : WorkerSafetyStatus.Recovering;
}

// Each flee round runs to a destination kept until the round ends, so the
// worker is not turned around on every update as the enemies move. A worker
// no longer attacked stops halfway, so it does not run further from its work
// than needed.
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

  if (record.fleeRound) {
    if (!worker.isAttacked && fledHalfway(worker, record.fleeRound)) {
      stopFleeing(worker);
    } else if (!fleeRoundFinished(worker, record.fleeRound)) {
      return;
    }

    record.fleeRound = undefined;

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
function fleeRoundFinished(worker: ObservedWorker, round: FleeRound): boolean {
  return (
    worker.isIdle ||
    new Vector(worker.position, round.destination).length <=
      FLEE_DESTINATION_REACHED_DISTANCE
  );
}

function fledHalfway(worker: ObservedWorker, round: FleeRound): boolean {
  return (
    new Vector(round.origin, worker.position).length >= FLEE_ROUND_DISTANCE / 2
  );
}

// Left moving, the worker would run the rest of the way while other code
// already treats it as no longer fleeing.
function stopFleeing(worker: ObservedWorker) {
  if (!worker.isIdle && !W3UnitApi.IssueImmediateOrder(worker.unit, "stop")) {
    debug("Worker safety: stop order rejected.");
  }
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
    record.fleeRound = { origin: worker.position, destination };
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
      new Vector(position, enemy.position).length <= THREAT_RADIUS,
  );
}

function averagePosition(enemies: VisibleEnemy[]): Point {
  const origin = new Point(0, 0);
  let sum = new Vector(0, 0);

  for (const enemy of enemies) {
    sum = sum.add(new Vector(origin, enemy.position));
  }

  return origin.translate(sum.multiply(1 / enemies.length));
}

// Undefined when standing on the threat, which gives no direction.
function angleAwayFrom(threat: Point, from: Point): number | undefined {
  const away = new Vector(threat, from);

  return away.isZeroLength() ? undefined : away.slope;
}

function pointAt(from: Point, angle: number, distance: number): Point {
  return from.translate(new Vector(distance, 0).rotate(angle));
}
