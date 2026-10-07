import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { Vector } from "@lib/math";
import { debug } from "../../../debug";
import {
  CommonBeliefs,
  GoldMine,
  positionOf,
} from "../../../beliefs/common.beliefs";
import { TowerRushState } from "../tower-rush.state";

// A move order to a gold mine ends at the mine's edge, not its center.
const ARRIVAL_RADIUS = 400;

export interface MoveForwardState {
  forwardWorkersSentToEnemy: W3UnitApi.unit[];
  forwardWorkersHoldingPosition: W3UnitApi.unit[];
}

export function createMoveForwardState(): MoveForwardState {
  return { forwardWorkersSentToEnemy: [], forwardWorkersHoldingPosition: [] };
}

/** Returns whether the forward workers have arrived as Peasants again. */
export function updateMoveForward(
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
  state: MoveForwardState,
): boolean {
  const destination = beliefs.enemyMainGoldMine;

  if (!destination) {
    throw new Error("Tower rush: enemy main gold mine not found.");
  }

  holdArrivedMilitia(destination, beliefs, state);
  sendNewMilitiaToEnemy(destination, beliefs, rush, state);

  return forwardWorkersHaveRevertedToPeasants(beliefs, rush, state);
}

// Warcraft scripts cannot queue orders, so a move issued together with the
// Call to Arms order would cancel the transformation. Forward workers are
// sent only once they have become Militia.
function sendNewMilitiaToEnemy(
  destination: GoldMine,
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
  state: MoveForwardState,
) {
  for (const worker of rush.forwardWorkers) {
    if (
      beliefs.militia.includes(worker) &&
      !state.forwardWorkersSentToEnemy.includes(worker)
    ) {
      W3UnitApi.IssuePointOrder(
        worker,
        "move",
        destination.position.x,
        destination.position.y,
      );
      state.forwardWorkersSentToEnemy.push(worker);
    }
  }
}

// Idle Militia acquire and chase nearby enemies on their own, which would
// pull them away from the tower sites before they revert to Peasants.
function holdArrivedMilitia(
  destination: GoldMine,
  beliefs: Readonly<CommonBeliefs>,
  state: MoveForwardState,
) {
  for (const worker of state.forwardWorkersSentToEnemy) {
    if (
      beliefs.militia.includes(worker) &&
      !state.forwardWorkersHoldingPosition.includes(worker) &&
      new Vector(positionOf(beliefs, worker), destination.position).length <=
        ARRIVAL_RADIUS
    ) {
      if (W3UnitApi.IssueImmediateOrder(worker, "holdposition")) {
        state.forwardWorkersHoldingPosition.push(worker);
      } else {
        debug("Tower rush: hold position order rejected.");
      }
    }
  }
}

function forwardWorkersHaveRevertedToPeasants(
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
  state: MoveForwardState,
): boolean {
  const survivingForwardWorkers = rush.forwardWorkers.filter(
    (worker) =>
      beliefs.peasants.includes(worker) || beliefs.militia.includes(worker),
  );

  return (
    survivingForwardWorkers.length > 0 &&
    survivingForwardWorkers.every(
      (worker) =>
        state.forwardWorkersSentToEnemy.includes(worker) &&
        beliefs.peasants.includes(worker),
    )
  );
}
