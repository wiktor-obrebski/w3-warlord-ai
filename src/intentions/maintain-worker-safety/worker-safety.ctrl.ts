import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3MathApi from "@lib/warcraft3-api/math";
import * as W3TerrainApi from "@lib/warcraft3-api/terrain";
import { AnyBeliefModel, BeliefContainer, Controller } from "@lib/bdi";
import { Point, Vector } from "@lib/math";
import { debug } from "../../debug";
import {
  CommonBeliefModel,
  CommonBeliefs,
  OwnUnit,
} from "../../beliefs/common.beliefs";
import { isRecentlyAttacked } from "../../beliefs/common.assessments";
import { WorkerSafetyBeliefModel } from "./worker-safety.beliefs";
import {
  isRecoveringFromAttack,
  nearbyThreats,
  threatCenter,
} from "./worker-safety.assessments";

const FLEE_ROUND_DISTANCE = 300;
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
  statusOf(
    worker: W3UnitApi.unit,
    beliefs: Readonly<BeliefContainer>,
  ): WorkerSafetyStatus;
}

export function isWorkerSafe(
  safety: WorkerSafety,
  worker: W3UnitApi.unit,
  beliefs: Readonly<BeliefContainer>,
): boolean {
  return safety.statusOf(worker, beliefs) === WorkerSafetyStatus.Safe;
}

interface FleeRound {
  origin: Point;
  destination: Point;
}

/** Attacked workers run away from the nearby enemy force. */
export class WorkerSafetyController
  implements Controller<BeliefContainer>, WorkerSafety
{
  public readonly beliefModels: readonly AnyBeliefModel[];
  private readonly common: CommonBeliefModel;
  private readonly safetyBeliefs: WorkerSafetyBeliefModel;
  private readonly fleeRounds = new Map<W3UnitApi.unit, FleeRound>();

  public constructor(common: CommonBeliefModel) {
    this.common = common;
    this.safetyBeliefs = new WorkerSafetyBeliefModel(common);
    this.beliefModels = [this.safetyBeliefs];
  }

  public update(container: Readonly<BeliefContainer>) {
    const beliefs = container.get(this.common);

    for (const worker of beliefs.workers) {
      this.protectWorker(worker, beliefs);
    }

    this.forgetFleeRoundsOfLostWorkers(beliefs);
  }

  public statusOf(
    worker: W3UnitApi.unit,
    beliefs: Readonly<BeliefContainer>,
  ): WorkerSafetyStatus {
    if (this.fleeRounds.has(worker)) {
      return WorkerSafetyStatus.Fleeing;
    }

    return isRecoveringFromAttack(beliefs.get(this.safetyBeliefs), worker)
      ? WorkerSafetyStatus.Recovering
      : WorkerSafetyStatus.Safe;
  }

  // Each flee round runs to a destination kept until the round ends, so the
  // worker is not turned around on every update as the enemies move. A worker
  // no longer attacked stops halfway, so it does not run further from its
  // work than needed.
  private protectWorker(worker: OwnUnit, beliefs: Readonly<CommonBeliefs>) {
    const isAttacked = isRecentlyAttacked(beliefs, worker.unit);
    const round = this.fleeRounds.get(worker.unit);

    if (round) {
      if (!isAttacked && fledHalfway(worker, round)) {
        stopFleeing(worker);
      } else if (!fleeRoundFinished(worker, round)) {
        return;
      }

      this.fleeRounds.delete(worker.unit);

      if (!isAttacked) {
        debug("Worker safety: worker is no longer attacked.");
      }
    }

    if (isAttacked) {
      const nextRound = startFleeRound(worker, beliefs);

      if (nextRound) {
        this.fleeRounds.set(worker.unit, nextRound);
      }
    }
  }

  private forgetFleeRoundsOfLostWorkers(beliefs: Readonly<CommonBeliefs>) {
    const lost: W3UnitApi.unit[] = [];

    for (const worker of this.fleeRounds.keys()) {
      if (!beliefs.workers.some((alive) => alive.unit === worker)) {
        lost.push(worker);
      }
    }

    for (const worker of lost) {
      this.fleeRounds.delete(worker);
    }
  }
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
): FleeRound | undefined {
  const nearby = nearbyThreats(beliefs, worker.position);
  const threat = threatCenter(beliefs, worker);
  const awayAngle = threat && angleAwayFrom(threat, worker.position);
  const destination = fleeDestination(worker.position, awayAngle);

  if (
    !W3UnitApi.IssuePointOrder(worker.unit, "move", destination.x, destination.y)
  ) {
    debug("Worker safety: flee order rejected.");
    return undefined;
  }

  debug(
    `Worker safety: attacked worker flees from ${nearby.length} nearby enemies.`,
  );

  return { origin: worker.position, destination };
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

// Undefined when standing on the threat, which gives no direction.
function angleAwayFrom(threat: Point, from: Point): number | undefined {
  const away = new Vector(threat, from);

  return away.isZeroLength() ? undefined : away.slope;
}

function pointAt(from: Point, angle: number, distance: number): Point {
  return from.translate(new Vector(distance, 0).rotate(angle));
}
