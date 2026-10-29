import { Vector } from '@lib/math';
import type { ActorControl } from '../../../../contracts/actor-control';
import type { UnitId } from '../../../../contracts/ids';
import type { OrderQueue } from '../../../../contracts/orders';
import type { GoldMine } from '../../../../contracts/world';
import type { Beliefs } from '../../../../contracts/beliefs';
import { TowerRushState } from '../tower-rush.state';
import { positionOf } from '../tower-rush.assessments';

export { type MoveForwardState, createMoveForwardState, updateMoveForward };

interface MoveForwardState {
  forwardWorkersSentToEnemy: UnitId[];
  forwardWorkersHoldingPosition: UnitId[];
}

function createMoveForwardState(): MoveForwardState {
  return { forwardWorkersSentToEnemy: [], forwardWorkersHoldingPosition: [] };
}

interface UpdateMoveForwardArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
  moveForwardState: MoveForwardState;
  actorControl: ActorControl;
  orders: OrderQueue;
}

/** Returns whether the forward workers `arrived` as Peasants again. */
function updateMoveForward({
  beliefs,
  rush,
  moveForwardState,
  actorControl,
  orders,
}: UpdateMoveForwardArgs): { arrived: boolean } {
  const destination = beliefs.enemy.mainGoldMine;

  if (!destination) {
    throw new Error('Tower rush: enemy main gold mine not found.');
  }

  const controlled = rush.forwardWorkers.filter(
    (worker) =>
      beliefs.self.units.has(worker) &&
      actorControl.request({ actor: worker, request: 'normal' })
  );

  holdArrivedMilitia({
    destination,
    beliefs,
    moveForwardState,
    controlled,
    orders,
  });
  sendNewMilitiaToEnemy({
    destination,
    beliefs,
    moveForwardState,
    controlled,
    orders,
  });

  return {
    arrived: forwardWorkersHaveRevertedToPeasants({
      beliefs,
      rush,
      moveForwardState,
    }),
  };
}

// A move order to a gold mine ends at the mine's edge, not its center.
const ArrivalRadius = 400;

interface SendNewMilitiaToEnemyArgs {
  destination: GoldMine;
  beliefs: Beliefs;
  moveForwardState: MoveForwardState;
  controlled: readonly UnitId[];
  orders: OrderQueue;
}

// Warcraft scripts cannot queue orders, so a move issued together with the
// Call to Arms order would cancel the transformation. Forward workers are
// sent only once they have become Militia.
function sendNewMilitiaToEnemy({
  destination,
  beliefs,
  moveForwardState,
  controlled,
  orders,
}: SendNewMilitiaToEnemyArgs) {
  for (const worker of controlled) {
    if (
      beliefs.self.militia.includes(worker) &&
      !moveForwardState.forwardWorkersSentToEnemy.includes(worker)
    ) {
      orders.queue({
        order: {
          kind: 'point',
          unit: worker,
          orderString: 'move',
          point: destination.position,
          reason: 'Tower rush: forward Militia moves to the enemy main',
        },
      });
      moveForwardState.forwardWorkersSentToEnemy.push(worker);
    }
  }
}

interface HoldArrivedMilitiaArgs {
  destination: GoldMine;
  beliefs: Beliefs;
  moveForwardState: MoveForwardState;
  controlled: readonly UnitId[];
  orders: OrderQueue;
}

// Idle Militia acquire and chase nearby enemies on their own, which would
// pull them away from the tower sites before they revert to Peasants.
function holdArrivedMilitia({
  destination,
  beliefs,
  moveForwardState,
  controlled,
  orders,
}: HoldArrivedMilitiaArgs) {
  for (const worker of moveForwardState.forwardWorkersSentToEnemy) {
    if (
      controlled.includes(worker) &&
      beliefs.self.militia.includes(worker) &&
      !moveForwardState.forwardWorkersHoldingPosition.includes(worker) &&
      new Vector({
        start: positionOf({ beliefs, unit: worker }),
        end: destination.position,
      }).length <= ArrivalRadius
    ) {
      orders.queue({
        order: {
          kind: 'immediate',
          unit: worker,
          orderString: 'holdposition',
          reason: 'Tower rush: arrived Militia holds position',
        },
        onRefused: () => {
          moveForwardState.forwardWorkersHoldingPosition =
            moveForwardState.forwardWorkersHoldingPosition.filter(
              (holding) => holding !== worker
            );
        },
      });
      moveForwardState.forwardWorkersHoldingPosition.push(worker);
    }
  }
}

interface ForwardWorkersHaveRevertedToPeasantsArgs {
  beliefs: Beliefs;
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
      beliefs.self.peasants.includes(worker) ||
      beliefs.self.militia.includes(worker)
  );

  return (
    survivingForwardWorkers.length > 0 &&
    survivingForwardWorkers.every(
      (worker) =>
        moveForwardState.forwardWorkersSentToEnemy.includes(worker) &&
        beliefs.self.peasants.includes(worker)
    )
  );
}
