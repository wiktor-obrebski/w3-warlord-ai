import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { debug } from '../../debug';
import { Point, Vector } from '@lib/math';
import { ActorControl, NORMAL_REQUEST } from '../../actor';
import { CommonBeliefs } from '../../beliefs/common.beliefs';
import { closestUnit, positionOf } from '../../beliefs/common.assessments';
import { TowerRushState } from './tower-rush.state';

export { hideBehindClosestTower, forgetSentToSafety, controlForwardPeasants };

// Clears the tower's 128x128 footprint with room for the Peasant.
const HidingDistanceBehindTower = 160;

function hideBehindClosestTower({
  worker,
  towers,
  enemyMain,
  beliefs,
  rush,
}: {
  worker: W3UnitApi.unit;
  towers: readonly W3UnitApi.unit[];
  enemyMain: Point;
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
}) {
  const shelter = closestUnit({ beliefs, units: towers, to: worker });

  if (!shelter) {
    return;
  }

  const spot = spotBehind({
    tower: positionOf({ beliefs, unit: shelter }),
    enemyMain,
  });

  if (W3UnitApi.IssuePointOrder(worker, 'move', spot.x, spot.y)) {
    rush.forwardWorkersSentToSafety.push(worker);
    debug({ message: 'Tower rush: forward Peasant hides behind a tower.' });
  } else {
    debug({ message: 'Tower rush: move to safety rejected.' });
  }
}

function forgetSentToSafety({
  worker,
  rush,
}: {
  worker: W3UnitApi.unit;
  rush: TowerRushState;
}) {
  rush.forwardWorkersSentToSafety = rush.forwardWorkersSentToSafety.filter(
    (sent) => sent !== worker
  );
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
  control,
}: {
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
  control: ActorControl;
}): W3UnitApi.unit[] {
  const controlled: W3UnitApi.unit[] = [];

  for (const worker of rush.forwardWorkers) {
    if (!beliefs.peasants.includes(worker)) {
      continue;
    }

    if (control.request({ actor: worker, request: NORMAL_REQUEST })) {
      controlled.push(worker);
    } else {
      forgetSentToSafety({ worker, rush });
    }
  }

  return controlled;
}

// On the far side of the tower as seen from the enemy main hall.
function spotBehind({
  tower,
  enemyMain,
}: {
  tower: Point;
  enemyMain: Point;
}): Point {
  const awayFromEnemyMain = new Vector({
    start: enemyMain,
    end: tower,
  }).normalize();

  return tower.translate({
    vector: awayFromEnemyMain.multiply({ scalar: HidingDistanceBehindTower }),
  });
}
