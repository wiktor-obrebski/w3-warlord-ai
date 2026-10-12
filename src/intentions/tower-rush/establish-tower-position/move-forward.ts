import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { Vector } from '@lib/math';
import { debug } from '../../../debug';
import { ActorControl, NORMAL_REQUEST } from '../../../actor';
import { CommonBeliefs, GoldMine } from '../../../beliefs/common.beliefs';
import { positionOf } from '../../../beliefs/common.assessments';
import { TowerRushState } from '../tower-rush.state';

export { type MoveForwardState, createMoveForwardState, updateMoveForward };

// A move order to a gold mine ends at the mine's edge, not its center.
const ArrivalRadius = 400;

interface MoveForwardState {
  forwardWorkersSentToEnemy: W3UnitApi.unit[];
  forwardWorkersHoldingPosition: W3UnitApi.unit[];
}

function createMoveForwardState(): MoveForwardState {
  return { forwardWorkersSentToEnemy: [], forwardWorkersHoldingPosition: [] };
}

interface UpdateMoveForwardArgs {
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
  state: MoveForwardState;
  control: ActorControl;
}

/** Returns whether the forward workers have arrived as Peasants again. */
function updateMoveForward({
  beliefs,
  rush,
  state,
  control,
}: UpdateMoveForwardArgs): boolean {
  const destination = beliefs.enemyMainGoldMine;

  if (!destination) {
    throw new Error('Tower rush: enemy main gold mine not found.');
  }

  const controlled = rush.forwardWorkers.filter(
    (worker) =>
      beliefs.ownUnits.has(worker) &&
      control.request({ actor: worker, request: NORMAL_REQUEST })
  );

  holdArrivedMilitia({ destination, beliefs, state, controlled });
  sendNewMilitiaToEnemy({ destination, beliefs, state, controlled });

  return forwardWorkersHaveRevertedToPeasants({ beliefs, rush, state });
}

interface SendNewMilitiaToEnemyArgs {
  destination: GoldMine;
  beliefs: Readonly<CommonBeliefs>;
  state: MoveForwardState;
  controlled: readonly W3UnitApi.unit[];
}

// Warcraft scripts cannot queue orders, so a move issued together with the
// Call to Arms order would cancel the transformation. Forward workers are
// sent only once they have become Militia.
function sendNewMilitiaToEnemy({
  destination,
  beliefs,
  state,
  controlled,
}: SendNewMilitiaToEnemyArgs) {
  for (const worker of controlled) {
    if (
      beliefs.militia.includes(worker) &&
      !state.forwardWorkersSentToEnemy.includes(worker)
    ) {
      W3UnitApi.IssuePointOrder(
        worker,
        'move',
        destination.position.x,
        destination.position.y
      );
      state.forwardWorkersSentToEnemy.push(worker);
    }
  }
}

interface HoldArrivedMilitiaArgs {
  destination: GoldMine;
  beliefs: Readonly<CommonBeliefs>;
  state: MoveForwardState;
  controlled: readonly W3UnitApi.unit[];
}

// Idle Militia acquire and chase nearby enemies on their own, which would
// pull them away from the tower sites before they revert to Peasants.
function holdArrivedMilitia({
  destination,
  beliefs,
  state,
  controlled,
}: HoldArrivedMilitiaArgs) {
  for (const worker of state.forwardWorkersSentToEnemy) {
    if (
      controlled.includes(worker) &&
      beliefs.militia.includes(worker) &&
      !state.forwardWorkersHoldingPosition.includes(worker) &&
      new Vector({
        start: positionOf({ beliefs, unit: worker }),
        end: destination.position,
      }).length <= ArrivalRadius
    ) {
      if (W3UnitApi.IssueImmediateOrder(worker, 'holdposition')) {
        state.forwardWorkersHoldingPosition.push(worker);
      } else {
        debug({ message: 'Tower rush: hold position order rejected.' });
      }
    }
  }
}

interface ForwardWorkersHaveRevertedToPeasantsArgs {
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
  state: MoveForwardState;
}

function forwardWorkersHaveRevertedToPeasants({
  beliefs,
  rush,
  state,
}: ForwardWorkersHaveRevertedToPeasantsArgs): boolean {
  const survivingForwardWorkers = rush.forwardWorkers.filter(
    (worker) =>
      beliefs.peasants.includes(worker) || beliefs.militia.includes(worker)
  );

  return (
    survivingForwardWorkers.length > 0 &&
    survivingForwardWorkers.every(
      (worker) =>
        state.forwardWorkersSentToEnemy.includes(worker) &&
        beliefs.peasants.includes(worker)
    )
  );
}
