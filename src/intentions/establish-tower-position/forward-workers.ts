import { Point, Vector } from '@lib/math';
import type { Directives } from '../../contracts/directives';
import type { UnitId } from '../../contracts/ids';
import type { WarlordForce } from '../../contracts/intentions';
import type { DecisionRecorder } from '../../contracts/record';
import type { Beliefs } from '../../contracts/beliefs';
import { TowerRushState } from './tower-rush.state';
import { closestUnit, positionOf } from './tower-rush.judgments';

export { hideBehindClosestTower, forgetSentToSafety, forwardPeasantsInForce };

interface HideBehindClosestTowerArgs {
  worker: UnitId;
  towers: readonly UnitId[];
  enemyMain: Point;
  beliefs: Beliefs;
  rush: TowerRushState;
  directives: Directives;
  recorder: DecisionRecorder;
}

function hideBehindClosestTower({
  worker,
  towers,
  enemyMain,
  beliefs,
  rush,
  directives,
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

  directives.give({
    unit: worker,
    task: { kind: 'Move', point: spot },
    reason: 'Tower rush: forward Peasant hides behind a tower',
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

interface ForwardPeasantsInForceArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
  force: WarlordForce;
}

/**
 * The living forward Peasants in the run's force.
 *
 * A Peasant missing from the force, claimed by worker safety, may have left
 * its hiding spot, so it is sent to hide again once back. Worker safety
 * claims an attacked Peasant for longer than the time between two tower rush
 * updates, so a claim is always seen here.
 */
function forwardPeasantsInForce({
  beliefs,
  rush,
  force,
}: ForwardPeasantsInForceArgs): UnitId[] {
  const inForce: UnitId[] = [];

  for (const worker of rush.forwardWorkers) {
    if (!beliefs.self.peasants.includes(worker)) {
      continue;
    }

    if (force.units.has(worker)) {
      inForce.push(worker);
    } else {
      forgetSentToSafety({ worker, rush });
    }
  }

  return inForce;
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
