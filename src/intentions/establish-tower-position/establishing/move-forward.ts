import { Vector } from '@lib/math';
import type { Directive } from '../../../contracts/directives';
import type { UnitId } from '../../../contracts/ids';
import type { WarlordForce } from '../../../contracts/intentions';
import type { GoldMine } from '../../../contracts/world';
import type { Beliefs } from '../../../contracts/beliefs';
import { TowerRushState } from '../tower-rush.state';
import { positionOf } from '../tower-rush.judgments';

export { type MoveForwardState, createMoveForwardState, updateMoveForward };

interface MoveForwardState {
  forwardWorkersSentToEnemy: UnitId[];
}

function createMoveForwardState(): MoveForwardState {
  return { forwardWorkersSentToEnemy: [] };
}

interface UpdateMoveForwardArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
  moveForwardState: MoveForwardState;
  force: WarlordForce;
  directives: Directive[];
}

/** Returns whether the forward workers `arrived` as Peasants again. */
function updateMoveForward({
  beliefs,
  rush,
  moveForwardState,
  force,
  directives,
}: UpdateMoveForwardArgs): { arrived: boolean } {
  const destination = beliefs.enemy.mainGoldMine;

  if (!destination) {
    throw new Error('Tower rush: enemy main gold mine not found.');
  }

  const inForce = rush.forwardWorkers.filter((worker) =>
    force.units.has(worker)
  );

  holdArrivedMilitia({
    destination,
    beliefs,
    moveForwardState,
    inForce,
    directives,
  });
  sendNewMilitiaToEnemy({
    destination,
    beliefs,
    moveForwardState,
    inForce,
    directives,
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
  inForce: readonly UnitId[];
  directives: Directive[];
}

// Warcraft scripts cannot queue orders, so a move issued together with the
// Call to Arms order would cancel the transformation. Forward workers are
// sent only once they have become Militia.
function sendNewMilitiaToEnemy({
  destination,
  beliefs,
  moveForwardState,
  inForce,
  directives,
}: SendNewMilitiaToEnemyArgs) {
  for (const worker of inForce) {
    if (
      beliefs.self.militia.includes(worker) &&
      !moveForwardState.forwardWorkersSentToEnemy.includes(worker)
    ) {
      directives.push({
        unit: worker,
        task: { kind: 'Move', point: destination.position },
        reason: 'Tower rush: forward Militia moves to the enemy main',
      });
      moveForwardState.forwardWorkersSentToEnemy.push(worker);
    }
  }
}

interface HoldArrivedMilitiaArgs {
  destination: GoldMine;
  beliefs: Beliefs;
  moveForwardState: MoveForwardState;
  inForce: readonly UnitId[];
  directives: Directive[];
}

// Idle Militia acquire and chase nearby enemies on their own, which would
// pull them away from the tower sites before they revert to Peasants.
function holdArrivedMilitia({
  destination,
  beliefs,
  moveForwardState,
  inForce,
  directives,
}: HoldArrivedMilitiaArgs) {
  for (const worker of moveForwardState.forwardWorkersSentToEnemy) {
    if (
      inForce.includes(worker) &&
      beliefs.self.militia.includes(worker) &&
      new Vector({
        start: positionOf({ beliefs, unit: worker }),
        end: destination.position,
      }).length <= ArrivalRadius
    ) {
      directives.push({
        unit: worker,
        task: { kind: 'Hold' },
        reason: 'Tower rush: arrived Militia holds position',
      });
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
