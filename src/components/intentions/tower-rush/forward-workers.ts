import { Point, Vector } from '@lib/math';
import type { ActorControl } from '../../../contracts/actor-control';
import type { UnitId } from '../../../contracts/ids';
import type { OrderQueue } from '../../../contracts/orders';
import type { DecisionRecorder } from '../../../contracts/record';
import type { TowerRushCommonBeliefs } from './tower-rush.common-beliefs';
import { TowerRushState } from './tower-rush.state';
import { closestUnit, positionOf } from './tower-rush.assessments';

export { hideBehindClosestTower, forgetSentToSafety, controlForwardPeasants };

interface HideBehindClosestTowerArgs {
  worker: UnitId;
  towers: readonly UnitId[];
  enemyMain: Point;
  beliefs: Readonly<TowerRushCommonBeliefs>;
  rush: TowerRushState;
  orders: OrderQueue;
  recorder: DecisionRecorder;
}

function hideBehindClosestTower({
  worker,
  towers,
  enemyMain,
  beliefs,
  rush,
  orders,
  recorder,
}: HideBehindClosestTowerArgs) {
  const shelter = closestUnit({ beliefs, units: towers, to: worker });

  if (!shelter) {
    return;
  }

  const spot = spotBehind({
    tower: positionOf({ beliefs, unit: shelter }),
    enemyMain,
  });

  orders.queue({
    order: {
      kind: 'point',
      unit: worker,
      orderString: 'move',
      point: spot,
      reason: 'Tower rush: forward Peasant hides behind a tower',
    },
    onRefused: () => forgetSentToSafety({ worker, rush }),
  });
  rush.forwardWorkersSentToSafety.push(worker);
  recorder.note({
    message: 'Tower rush: forward Peasant hides behind a tower.',
  });
}

interface ForgetSentToSafetyArgs {
  worker: UnitId;
  rush: TowerRushState;
}

function forgetSentToSafety({ worker, rush }: ForgetSentToSafetyArgs) {
  rush.forwardWorkersSentToSafety = rush.forwardWorkersSentToSafety.filter(
    (sent) => sent !== worker
  );
}

interface ControlForwardPeasantsArgs {
  beliefs: Readonly<TowerRushCommonBeliefs>;
  rush: TowerRushState;
  actorControl: ActorControl;
}

/**
 * Requests control of the living forward Peasants and returns those granted.
 *
 * A Peasant taken over, e.g. by worker safety, may have left its hiding spot,
 * so it is sent to hide again once regained. Worker safety holds an attacked
 * Peasant for longer than the time between two tower rush updates, so a
 * takeover is always seen here.
 */
function controlForwardPeasants({
  beliefs,
  rush,
  actorControl,
}: ControlForwardPeasantsArgs): UnitId[] {
  const controlled: UnitId[] = [];

  for (const worker of rush.forwardWorkers) {
    if (!beliefs.peasants.includes(worker)) {
      continue;
    }

    if (actorControl.request({ actor: worker, request: 'normal' })) {
      controlled.push(worker);
    } else {
      forgetSentToSafety({ worker, rush });
    }
  }

  return controlled;
}

// Clears the tower's 128x128 footprint with room for the Peasant.
const HidingDistanceBehindTower = 160;

interface SpotBehindArgs {
  tower: Point;
  enemyMain: Point;
}

// On the far side of the tower as seen from the enemy main hall.
function spotBehind({ tower, enemyMain }: SpotBehindArgs): Point {
  const awayFromEnemyMain = new Vector({
    start: enemyMain,
    end: tower,
  }).normalize();

  return tower.translate({
    vector: awayFromEnemyMain.multiply({ scalar: HidingDistanceBehindTower }),
  });
}
