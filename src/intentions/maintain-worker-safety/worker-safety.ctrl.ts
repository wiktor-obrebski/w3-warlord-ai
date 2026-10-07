import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3MathApi from "@lib/warcraft3-api/math";
import * as W3TerrainApi from "@lib/warcraft3-api/terrain";
import { BeliefContainer, Controller } from "@lib/bdi";
import { Point, Vector } from "@lib/math";
import { debug } from "../../debug";
import {
  CommonBeliefModel,
  CommonBeliefs,
  isRecentlyAttacked,
  OwnUnit,
  recentAttackTarget,
  VisibleEnemy,
} from "../../beliefs/common.beliefs";

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

/**
 * While a worker is not safe, it belongs to worker safety: other code must
 * not order it.
 */
export interface WorkerSafety {
  statusOf(worker: W3UnitApi.unit, now: number): WorkerSafetyStatus;
}

export function isWorkerSafe(
  safety: WorkerSafety,
  worker: W3UnitApi.unit,
  now: number,
): boolean {
  return safety.statusOf(worker, now) === WorkerSafetyStatus.Safe;
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

/** Attacked workers run away from the nearby enemy force. */
export class WorkerSafetyController
  implements Controller<BeliefContainer>, WorkerSafety
{
  private readonly common: CommonBeliefModel;
  // Workers recently attacked; any worker without a record is safe.
  private records: WorkerSafetyRecord[] = [];

  public constructor(common: CommonBeliefModel) {
    this.common = common;
  }

  public update(container: Readonly<BeliefContainer>) {
    const beliefs = container.get(this.common);

    for (const worker of beliefs.workers) {
      this.protectWorker(worker, beliefs);
    }

    this.records = this.records.filter(
      (record) =>
        beliefs.workers.some((worker) => worker.unit === record.worker) &&
        statusOf(record, beliefs.time) !== WorkerSafetyStatus.Safe,
    );
  }

  public statusOf(worker: W3UnitApi.unit, now: number): WorkerSafetyStatus {
    const record = this.records.find((entry) => entry.worker === worker);

    return record ? statusOf(record, now) : WorkerSafetyStatus.Safe;
  }

  // Each flee round runs to a destination kept until the round ends, so the
  // worker is not turned around on every update as the enemies move. A worker
  // no longer attacked stops halfway, so it does not run further from its
  // work than needed.
  private protectWorker(worker: OwnUnit, beliefs: Readonly<CommonBeliefs>) {
    let record = this.records.find((entry) => entry.worker === worker.unit);
    const isAttacked = isRecentlyAttacked(beliefs, worker.unit);

    if (isAttacked && record) {
      record.lastAttackedAt = beliefs.time;
    } else if (isAttacked) {
      record = { worker: worker.unit, lastAttackedAt: beliefs.time };
      this.records.push(record);
    }

    if (!record) {
      return;
    }

    if (record.fleeRound) {
      if (!isAttacked && fledHalfway(worker, record.fleeRound)) {
        stopFleeing(worker);
      } else if (!fleeRoundFinished(worker, record.fleeRound)) {
        return;
      }

      record.fleeRound = undefined;

      if (!isAttacked) {
        debug("Worker safety: worker is no longer attacked.");
      }
    }

    if (isAttacked) {
      startFleeRound(worker, beliefs, record);
    }
  }
}

function statusOf(record: WorkerSafetyRecord, now: number): WorkerSafetyStatus {
  if (record.fleeRound) {
    return WorkerSafetyStatus.Fleeing;
  }

  return now - record.lastAttackedAt >= SAFE_AFTER_ATTACK_SECONDS
    ? WorkerSafetyStatus.Safe
    : WorkerSafetyStatus.Recovering;
}

// An unreachable destination ends the move short of it, leaving the worker
// idle.
function fleeRoundFinished(worker: OwnUnit, round: FleeRound): boolean {
  return (
    worker.isIdle ||
    new Vector(worker.position, round.destination).length <=
      FLEE_DESTINATION_REACHED_DISTANCE
  );
}

function fledHalfway(worker: OwnUnit, round: FleeRound): boolean {
  return (
    new Vector(round.origin, worker.position).length >= FLEE_ROUND_DISTANCE / 2
  );
}

// Left moving, the worker would run the rest of the way while other code
// already treats it as no longer fleeing.
function stopFleeing(worker: OwnUnit) {
  if (!worker.isIdle && !W3UnitApi.IssueImmediateOrder(worker.unit, "stop")) {
    debug("Worker safety: stop order rejected.");
  }
}

function startFleeRound(
  worker: OwnUnit,
  beliefs: Readonly<CommonBeliefs>,
  record: WorkerSafetyRecord,
) {
  const nearby = nearbyThreats(worker.position, beliefs);
  const attackers = beliefs.visibleEnemies.filter(
    (enemy) => recentAttackTarget(beliefs, enemy.unit) === worker.unit,
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

/**
 * Whether ground units can walk at the point. Terrain pathing is static map
 * knowledge, so reading it is fair. Units standing there are not considered.
 */
function isWalkable(point: Point): boolean {
  // IsTerrainPathable is inverted: it returns false where the pathing type
  // is set, i.e. where the point is walkable.
  return !W3TerrainApi.IsTerrainPathable(
    point.x,
    point.y,
    W3TerrainApi.PATHING_TYPE_WALKABILITY,
  );
}

// The enemy force fighting near the worker: combat units and the Ancients
// that walk into the fight.
function nearbyThreats(
  position: Point,
  beliefs: Readonly<CommonBeliefs>,
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
