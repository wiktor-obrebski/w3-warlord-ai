import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { debug } from "../debug";
import { Point, VisibleEnemy } from "../perception/world-state";
import {
  ObservedWorker,
  WorkerThreats,
} from "../perception/perceive-worker-threats";

const FLEE_ROUND_DISTANCE = 300;
const SAFE_AFTER_ATTACK_SECONDS = 2;
// Not tuned in-game.
const THREAT_RADIUS = 1000;
const FLEE_DESTINATION_REACHED_DISTANCE = 32;

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
  threats: WorkerThreats,
) {
  for (const worker of threats.workers) {
    protectWorker(worker, threats, safety);
  }

  safety.records = safety.records.filter(
    (record) =>
      threats.workers.some((worker) => worker.unit === record.worker) &&
      statusOf(record, threats.time) !== WorkerSafetyStatus.Safe,
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
  threats: WorkerThreats,
  safety: WorkerSafety,
) {
  let record = safety.records.find((entry) => entry.worker === worker.unit);

  if (worker.isAttacked && record) {
    record.lastAttackedAt = threats.time;
  } else if (worker.isAttacked) {
    record = { worker: worker.unit, lastAttackedAt: threats.time };
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
    startFleeRound(worker, threats, record);
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

// Without a visible enemy to run from, e.g. when attacked by an invisible
// unit, the worker stays put; it still counts as attacked.
function startFleeRound(
  worker: ObservedWorker,
  threats: WorkerThreats,
  record: WorkerSafetyRecord,
) {
  const nearby = nearbyThreats(worker.position, threats);
  const attackers = threats.visibleEnemies.filter(
    (enemy) => enemy.attackTarget === worker.unit,
  );
  const reference = nearby.length > 0 ? nearby : attackers;

  if (reference.length === 0) {
    return;
  }

  const enemyCenter = averagePosition(reference);

  if (distanceBetween(worker.position, enemyCenter) === 0) {
    return;
  }

  const destination = pointAwayFrom(
    worker.position,
    enemyCenter,
    FLEE_ROUND_DISTANCE,
  );

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

// The enemy force fighting near the worker: combat units and the Ancients
// that walk into the fight.
function nearbyThreats(position: Point, threats: WorkerThreats): VisibleEnemy[] {
  return threats.visibleEnemies.filter(
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

function pointAwayFrom(from: Point, threat: Point, distance: number): Point {
  const length = distanceBetween(threat, from);

  return {
    x: from.x + ((from.x - threat.x) / length) * distance,
    y: from.y + ((from.y - threat.y) / length) * distance,
  };
}

function distanceBetween(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
