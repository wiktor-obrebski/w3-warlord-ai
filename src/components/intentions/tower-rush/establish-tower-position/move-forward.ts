import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { Vector } from '@lib/math';
import { debug } from '../../../../debug';
import type { ActorControl } from '../../../../contracts/actor-control';
import type { GoldMine } from '../../../../contracts/world';
import type { TowerRushCommonBeliefs } from '../tower-rush.common-beliefs';
import { TowerRushState } from '../tower-rush.state';
import { positionOf } from '../tower-rush.assessments';

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
  beliefs: Readonly<TowerRushCommonBeliefs>;
  rush: TowerRushState;
  moveForwardState: MoveForwardState;
  actorControl: ActorControl;
}

/** Returns whether the forward workers `arrived` as Peasants again. */
function updateMoveForward({
  beliefs,
  rush,
  moveForwardState,
  actorControl,
}: UpdateMoveForwardArgs): { arrived: boolean } {
  const destination = beliefs.enemyMainGoldMine;

  if (!destination) {
    throw new Error('Tower rush: enemy main gold mine not found.');
  }

  const controlled = rush.forwardWorkers.filter(
    (worker) =>
      beliefs.ownUnits.has(worker) &&
      actorControl.request({ actor: worker, request: 'normal' })
  );

  holdArrivedMilitia({
    destination,
    beliefs,
    moveForwardState,
    controlled,
  });
  sendNewMilitiaToEnemy({
    destination,
    beliefs,
    moveForwardState,
    controlled,
  });

  return {
    arrived: forwardWorkersHaveRevertedToPeasants({
      beliefs,
      rush,
      moveForwardState,
    }),
  };
}

interface SendNewMilitiaToEnemyArgs {
  destination: GoldMine;
  beliefs: Readonly<TowerRushCommonBeliefs>;
  moveForwardState: MoveForwardState;
  controlled: readonly W3UnitApi.unit[];
}

// Warcraft scripts cannot queue orders, so a move issued together with the
// Call to Arms order would cancel the transformation. Forward workers are
// sent only once they have become Militia.
function sendNewMilitiaToEnemy({
  destination,
  beliefs,
  moveForwardState,
  controlled,
}: SendNewMilitiaToEnemyArgs) {
  for (const worker of controlled) {
    if (
      beliefs.militia.includes(worker) &&
      !moveForwardState.forwardWorkersSentToEnemy.includes(worker)
    ) {
      W3UnitApi.IssuePointOrder(
        worker,
        'move',
        destination.position.x,
        destination.position.y
      );
      moveForwardState.forwardWorkersSentToEnemy.push(worker);
    }
  }
}

interface HoldArrivedMilitiaArgs {
  destination: GoldMine;
  beliefs: Readonly<TowerRushCommonBeliefs>;
  moveForwardState: MoveForwardState;
  controlled: readonly W3UnitApi.unit[];
}

// Idle Militia acquire and chase nearby enemies on their own, which would
// pull them away from the tower sites before they revert to Peasants.
function holdArrivedMilitia({
  destination,
  beliefs,
  moveForwardState,
  controlled,
}: HoldArrivedMilitiaArgs) {
  for (const worker of moveForwardState.forwardWorkersSentToEnemy) {
    if (
      controlled.includes(worker) &&
      beliefs.militia.includes(worker) &&
      !moveForwardState.forwardWorkersHoldingPosition.includes(worker) &&
      new Vector({
        start: positionOf({ beliefs, unit: worker }),
        end: destination.position,
      }).length <= ArrivalRadius
    ) {
      if (W3UnitApi.IssueImmediateOrder(worker, 'holdposition')) {
        moveForwardState.forwardWorkersHoldingPosition.push(worker);
      } else {
        debug({ message: 'Tower rush: hold position order rejected.' });
      }
    }
  }
}

interface ForwardWorkersHaveRevertedToPeasantsArgs {
  beliefs: Readonly<TowerRushCommonBeliefs>;
  rush: TowerRushState;
  moveForwardState: MoveForwardState;
}

function forwardWorkersHaveRevertedToPeasants({
  beliefs,
  rush,
  moveForwardState,
}: ForwardWorkersHaveRevertedToPeasantsArgs): boolean {
  const survivingForwardWorkers = rush.forwardWorkers.filter(
    (worker) =>
      beliefs.peasants.includes(worker) || beliefs.militia.includes(worker)
  );

  return (
    survivingForwardWorkers.length > 0 &&
    survivingForwardWorkers.every(
      (worker) =>
        moveForwardState.forwardWorkersSentToEnemy.includes(worker) &&
        beliefs.peasants.includes(worker)
    )
  );
}
