import { Point, Vector } from '@lib/math';
import type { Directive } from '../../contracts/directives';
import type { UnitId } from '../../contracts/ids';
import type {
  WarlordDirectiveStatuses,
  WarlordForce,
} from '../../contracts/intentions';
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
  directives: Directive[];
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

  const hide: Directive = {
    unit: worker,
    task: { kind: 'Move', point: spot },
    reason: 'Tower rush: forward Peasant hides behind a tower',
  };

  directives.push(hide);
  rush.forwardWorkersSentToSafety.set(worker, hide);
  recorder.note({
    message: 'Tower rush: forward Peasant hides behind a tower.',
  });
}

interface ForgetSentToSafetyArgs {
  worker: UnitId;
  rush: TowerRushState;
}

function forgetSentToSafety({ worker, rush }: ForgetSentToSafetyArgs) {
  rush.forwardWorkersSentToSafety.delete(worker);
}

interface ForwardPeasantsInForceArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
  force: WarlordForce;
  directiveStatuses: WarlordDirectiveStatuses;
}

/**
 * The living forward Peasants in the run's force.
 *
 * A Peasant is sent to hide again when its move to hide has failed, or once
 * it is back after missing from the force: claimed by worker safety, it may
 * have left its hiding spot. Worker safety claims an attacked Peasant for
 * longer than the time between two tower rush updates, so a claim is always
 * seen here.
 */
function forwardPeasantsInForce({
  beliefs,
  rush,
  force,
  directiveStatuses,
}: ForwardPeasantsInForceArgs): UnitId[] {
  const inForce: UnitId[] = [];

  for (const worker of rush.forwardWorkers) {
    if (!beliefs.self.peasants.includes(worker)) {
      continue;
    }

    const hide = rush.forwardWorkersSentToSafety.get(worker);
    const hideFailed =
      hide !== undefined && directiveStatuses.get(hide) === 'failed';

    if (!force.units.has(worker) || hideFailed) {
      forgetSentToSafety({ worker, rush });
    }

    if (force.units.has(worker)) {
      inForce.push(worker);
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
