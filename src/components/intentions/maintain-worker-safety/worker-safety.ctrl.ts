import { Point, Random, Vector } from '@lib/math';
import type { ActorControl } from '../../../contracts/actor-control';
import type { UnitId } from '../../../contracts/ids';
import type { OrderQueue } from '../../../contracts/orders';
import type { WarcraftProbes } from '../../../contracts/probes';
import type { DecisionRecorder } from '../../../contracts/record';
import type { OwnUnit } from '../../../contracts/world';
import type {
  AssembledWarlordComponent,
  WarlordBeliefs,
  WarlordController,
} from '../../../contracts/component';
import type { MaintainWorkerSafetyCommonBeliefs } from './maintain-worker-safety.common-beliefs';
import {
  WorkerSafetyBeliefs,
  workerSafetyBeliefsModel,
} from './worker-safety.beliefs';
import {
  isRecentlyAttacked,
  needsAttackProtection,
  nearbyThreats,
  threatCenter,
} from './worker-safety.assessments';

export { assembleWorkerSafetyController };

interface AssembleWorkerSafetyControllerArgs {
  capabilities: WorkerSafetyControllerCapabilities;
}

function assembleWorkerSafetyController({
  capabilities,
}: AssembleWorkerSafetyControllerArgs): AssembledWarlordComponent<
  WarlordController<MaintainWorkerSafetyCommonBeliefs, WorkerSafetyBeliefs>,
  MaintainWorkerSafetyCommonBeliefs
> {
  return {
    component: new WorkerSafetyController({ capabilities }),
    beliefsModel: workerSafetyBeliefsModel,
    children: [],
  };
}

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

interface WorkerSafetyControllerCapabilities {
  readonly actorControl: ActorControl;
  readonly orders: OrderQueue;
  readonly probes: WarcraftProbes;
  readonly recorder: DecisionRecorder;
  readonly random: Random;
}

interface WorkerSafetyControllerConstructorArgs {
  capabilities: WorkerSafetyControllerCapabilities;
}

interface WorkerSafetyControllerUpdateArgs {
  beliefs: WarlordBeliefs<
    MaintainWorkerSafetyCommonBeliefs,
    WorkerSafetyBeliefs
  >;
}

interface WorkerSafetyControllerProtectWorkerArgs {
  worker: OwnUnit;
  beliefs: Readonly<MaintainWorkerSafetyCommonBeliefs>;
}

interface WorkerSafetyControllerForgetFleeRoundsOfLostWorkersArgs {
  beliefs: Readonly<MaintainWorkerSafetyCommonBeliefs>;
}

/**
 * Attacked workers run away from the nearby enemy force. When each worker was
 * last attacked is kept in the controller's Scoped Beliefs.
 *
 * From the first attack until the worker is safe again, worker safety holds
 * preemptive control of it, taking it from whatever controlled it before, and
 * releases it by no longer requesting it. While recovering, the worker is not
 * ordered at all.
 */
class WorkerSafetyController implements WarlordController<
  MaintainWorkerSafetyCommonBeliefs,
  WorkerSafetyBeliefs
> {
  private readonly capabilities: WorkerSafetyControllerCapabilities;
  private readonly fleeRounds = new Map<UnitId, FleeRound>();

  public constructor({ capabilities }: WorkerSafetyControllerConstructorArgs) {
    this.capabilities = capabilities;
  }

  public update({
    beliefs: { commonBeliefs: beliefs, scopedBeliefs },
  }: WorkerSafetyControllerUpdateArgs) {
    for (const worker of beliefs.workers) {
      const isUnsafe =
        this.fleeRounds.has(worker.unit) ||
        needsAttackProtection({ beliefs: scopedBeliefs, worker: worker.unit });

      if (
        isUnsafe &&
        this.capabilities.actorControl.request({
          actor: worker.unit,
          request: 'preemptive',
        })
      ) {
        this.protectWorker({ worker, beliefs });
      }
    }

    this.forgetFleeRoundsOfLostWorkers({ beliefs });
  }

  // Each flee round runs to a destination kept until the round ends, so the
  // worker is not turned around on every update as the enemies move. A worker
  // no longer attacked stops halfway, so it does not run further from its
  // work than needed.
  private protectWorker({
    worker,
    beliefs,
  }: WorkerSafetyControllerProtectWorkerArgs) {
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

  private forgetFleeRoundsOfLostWorkers({
    beliefs,
  }: WorkerSafetyControllerForgetFleeRoundsOfLostWorkersArgs) {
    const lostWorkers: UnitId[] = [];

    for (const worker of this.fleeRounds.keys()) {
      if (
        !beliefs.workers.some((livingWorker) => livingWorker.unit === worker)
      ) {
        lostWorkers.push(worker);
      }
    }

    for (const worker of lostWorkers) {
      this.fleeRounds.delete(worker);
    }
  }
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
  beliefs: Readonly<MaintainWorkerSafetyCommonBeliefs>;
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
