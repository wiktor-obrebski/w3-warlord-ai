import { Point, Random, Vector } from '@lib/math';
import type { UnitId } from '../contracts/ids';
import type { OrderQueue } from '../contracts/orders';
import type { WarcraftProbes } from '../contracts/probes';
import type { DecisionRecorder } from '../contracts/record';
import type { OwnUnit } from '../contracts/world';
import type { Beliefs } from '../contracts/beliefs';
import {
  isRecentlyAttacked,
  nearbyThreats,
  threatCenter,
} from './worker-safety.judgments';

export { WorkerSafety, type WorkerSafetyCapabilities };

interface WorkerSafetyCapabilities {
  readonly orders: OrderQueue;
  readonly probes: WarcraftProbes;
  readonly recorder: DecisionRecorder;
  readonly random: Random;
}

interface WorkerSafetyConstructorArgs {
  capabilities: WorkerSafetyCapabilities;
}

interface WorkerSafetyClaimArgs {
  beliefs: Beliefs;
}

interface WorkerSafetyRememberAttacksArgs {
  beliefs: Beliefs;
}

interface WorkerSafetyProtectArgs {
  worker: OwnUnit;
  beliefs: Beliefs;
}

interface WorkerSafetyForgetLostWorkersArgs {
  beliefs: Beliefs;
}

/**
 * The workers' reflex: attacked workers run away from the nearby enemy
 * force.
 *
 * From the first attack until the worker is safe again, worker safety claims
 * it, whoever owns it, so no plan run directs it. While recovering, the
 * worker is not ordered at all.
 */
class WorkerSafety {
  private readonly capabilities: WorkerSafetyCapabilities;
  private readonly fleeRounds = new Map<UnitId, FleeRound>();
  // When each worker attacked within the last SafeAfterAttackSeconds was
  // last attacked.
  private readonly lastAttackedAt = new Map<UnitId, number>();
  // The workers claimed in this step.
  private protecting = new Set<UnitId>();

  public constructor({ capabilities }: WorkerSafetyConstructorArgs) {
    this.capabilities = capabilities;
  }

  /** Claims the workers that are not safe, for this step. */
  public claim({ beliefs }: WorkerSafetyClaimArgs) {
    this.forgetLostWorkers({ beliefs });
    this.rememberAttacks({ beliefs });
    this.protecting = new Set();

    for (const worker of beliefs.self.workers) {
      if (
        this.fleeRounds.has(worker.unit) ||
        this.lastAttackedAt.has(worker.unit)
      ) {
        this.protecting.add(worker.unit);
      }
    }
  }

  /** Whether the worker was claimed in this step. */
  public protects({ worker }: { worker: UnitId }): boolean {
    return this.protecting.has(worker);
  }

  // Each flee round runs to a destination kept until the round ends, so the
  // worker is not turned around on every update as the enemies move. A worker
  // no longer attacked stops halfway, so it does not run further from its
  // work than needed.
  public protect({ worker, beliefs }: WorkerSafetyProtectArgs) {
    const { orders, probes, recorder, random } = this.capabilities;
    const isAttacked = isRecentlyAttacked({
      beliefs,
      attackedUnit: worker.unit,
    });
    const round = this.fleeRounds.get(worker.unit);

    if (round) {
      if (!isAttacked && fledHalfway({ worker, round })) {
        stopFleeing({ worker, orders });
      } else if (!fleeRoundFinished({ worker, round })) {
        return;
      }

      this.fleeRounds.delete(worker.unit);

      if (!isAttacked) {
        recorder.note({
          message: 'Worker safety: worker is no longer attacked.',
        });
      }
    }

    if (isAttacked) {
      const nextRound = nextFleeRound({
        worker,
        beliefs,
        probes,
        recorder,
        random,
      });

      this.fleeRounds.set(worker.unit, nextRound);
      orders.queue({
        order: {
          kind: 'point',
          unit: worker.unit,
          orderString: 'move',
          point: nextRound.destination,
          reason: 'Worker safety: attacked worker flees',
        },
        onRefused: () => {
          this.fleeRounds.delete(worker.unit);
        },
      });
    }
  }

  private forgetLostWorkers({ beliefs }: WorkerSafetyForgetLostWorkersArgs) {
    const lostWorkers: UnitId[] = [];

    for (const worker of this.fleeRounds.keys()) {
      if (
        !beliefs.self.workers.some(
          (livingWorker) => livingWorker.unit === worker
        )
      ) {
        lostWorkers.push(worker);
      }
    }

    for (const worker of lostWorkers) {
      this.fleeRounds.delete(worker);
    }
  }

  // A dead worker's entry is left to expire like any other: ids are never
  // reused, so it cannot mark another worker.
  private rememberAttacks({ beliefs }: WorkerSafetyRememberAttacksArgs) {
    for (const worker of beliefs.self.workers) {
      if (isRecentlyAttacked({ beliefs, attackedUnit: worker.unit })) {
        this.lastAttackedAt.set(worker.unit, beliefs.time);
      }
    }

    const safeAgain: UnitId[] = [];

    for (const [worker, attackedAt] of this.lastAttackedAt) {
      if (beliefs.time - attackedAt >= SafeAfterAttackSeconds) {
        safeAgain.push(worker);
      }
    }

    for (const worker of safeAgain) {
      this.lastAttackedAt.delete(worker);
    }
  }
}

// A worker unattacked for this long is safe again.
const SafeAfterAttackSeconds = 1;
const FleeRoundDistance = 300;
const FleeDestinationReachedDistance = 32;
const FleeAngleStep = Math.PI / 6;
// Alternating to either side of straight away, ending straight back.
const FleeAngleOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6].map(
  (step) => step * FleeAngleStep
);

interface FleeRound {
  origin: Point;
  destination: Point;
}

interface FleeRoundFinishedArgs {
  worker: OwnUnit;
  round: FleeRound;
}

// An unreachable destination ends the move short of it, leaving the worker
// idle.
function fleeRoundFinished({ worker, round }: FleeRoundFinishedArgs): boolean {
  return (
    worker.isIdle ||
    new Vector({ start: worker.position, end: round.destination }).length <=
      FleeDestinationReachedDistance
  );
}

interface FledHalfwayArgs {
  worker: OwnUnit;
  round: FleeRound;
}

function fledHalfway({ worker, round }: FledHalfwayArgs): boolean {
  return (
    new Vector({ start: round.origin, end: worker.position }).length >=
    FleeRoundDistance / 2
  );
}

interface StopFleeingArgs {
  worker: OwnUnit;
  orders: OrderQueue;
}

// Left moving, the worker would run the rest of the way while other code
// already treats it as no longer fleeing.
function stopFleeing({ worker, orders }: StopFleeingArgs) {
  if (!worker.isIdle) {
    orders.queue({
      order: {
        kind: 'immediate',
        unit: worker.unit,
        orderString: 'stop',
        reason: 'Worker safety: worker safe again stops fleeing',
      },
    });
  }
}

interface NextFleeRoundArgs {
  worker: OwnUnit;
  beliefs: Beliefs;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
  random: Random;
}

function nextFleeRound({
  worker,
  beliefs,
  probes,
  recorder,
  random,
}: NextFleeRoundArgs): FleeRound {
  const threats = nearbyThreats({ beliefs, position: worker.position });
  const threat = threatCenter({ beliefs, worker });
  const awayAngle = threat && angleAwayFrom({ threat, from: worker.position });
  const destination = fleeDestination({
    from: worker.position,
    awayAngle,
    probes,
    recorder,
    random,
  });

  recorder.note({
    message: `Worker safety: attacked worker flees from ${threats.length} nearby enemies.`,
  });

  return { origin: worker.position, destination };
}

interface FleeDestinationArgs {
  from: Point;
  awayAngle: number | undefined;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
  random: Random;
}

// A worker standing still is easily killed, so it always runs somewhere.
// Directions closest to straight away come first; without a direction to
// run from, e.g. when the attacker is not visible, the search starts from a
// random one. When no direction is walkable, a random one is taken anyway
// and Warcraft moves the worker as close to it as it can.
function fleeDestination({
  from,
  awayAngle,
  probes,
  recorder,
  random,
}: FleeDestinationArgs): Point {
  const preferredAngle = awayAngle ?? random.real({ min: 0, max: Math.PI * 2 });

  for (const offset of FleeAngleOffsets) {
    const candidate = pointAt({
      from,
      angle: preferredAngle + offset,
      distance: FleeRoundDistance,
    });

    if (probes.isWalkable({ point: candidate })) {
      if (offset !== 0) {
        recorder.note({
          message: `Worker safety: straight away is blocked; fleeing ${Math.floor((offset * 180) / Math.PI)} degrees off.`,
        });
      }

      return candidate;
    }
  }

  recorder.note({
    message: 'Worker safety: no walkable flee direction; fleeing at random.',
  });

  return pointAt({
    from,
    angle: random.real({ min: 0, max: Math.PI * 2 }),
    distance: FleeRoundDistance,
  });
}

interface AngleAwayFromArgs {
  threat: Point;
  from: Point;
}

// Undefined when standing on the threat, which gives no direction.
function angleAwayFrom({
  threat,
  from,
}: AngleAwayFromArgs): number | undefined {
  const away = new Vector({ start: threat, end: from });

  return away.isZeroLength() ? undefined : away.slope;
}

interface PointAtArgs {
  from: Point;
  angle: number;
  distance: number;
}

function pointAt({ from, angle, distance }: PointAtArgs): Point {
  return from.translate({
    vector: new Vector({ x: distance, y: 0 }).rotate({ angle }),
  });
}
