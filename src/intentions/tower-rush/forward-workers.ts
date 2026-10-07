import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { BeliefContainer } from "@lib/bdi";
import { debug } from "../../debug";
import { Point, Vector } from "@lib/math";
import { CommonBeliefs } from "../../beliefs/common.beliefs";
import { closestUnit, positionOf } from "../../beliefs/common.assessments";
import { TowerRushState } from "./tower-rush.state";
import {
  isWorkerSafe,
  WorkerSafety,
} from "../maintain-worker-safety/worker-safety.ctrl";

// Clears the tower's 128x128 footprint with room for the Peasant.
const HIDING_DISTANCE_BEHIND_TOWER = 160;

export function hideBehindClosestTower(
  worker: W3UnitApi.unit,
  towers: readonly W3UnitApi.unit[],
  enemyMain: Point,
  beliefs: Readonly<CommonBeliefs>,
  rush: TowerRushState,
) {
  const shelter = closestUnit(beliefs, towers, worker);

  if (!shelter) {
    return;
  }

  const spot = spotBehind(positionOf(beliefs, shelter), enemyMain);

  if (W3UnitApi.IssuePointOrder(worker, "move", spot.x, spot.y)) {
    rush.forwardWorkersSentToSafety.push(worker);
    debug("Tower rush: forward Peasant hides behind a tower.");
  } else {
    debug("Tower rush: move to safety rejected.");
  }
}

export function forgetSentToSafety(worker: W3UnitApi.unit, rush: TowerRushState) {
  rush.forwardWorkersSentToSafety = rush.forwardWorkersSentToSafety.filter(
    (sent) => sent !== worker,
  );
}

// An attacked Peasant may have fled its hiding spot, so it is sent to hide
// again. A flee round can start and end between two tower rush updates, so
// this does not wait to see the Peasant fleeing.
export function forgetHidingOfUnsafeWorkers(
  beliefs: Readonly<BeliefContainer>,
  rush: TowerRushState,
  workerSafety: WorkerSafety,
) {
  rush.forwardWorkersSentToSafety = rush.forwardWorkersSentToSafety.filter(
    (worker) => isWorkerSafe(workerSafety, worker, beliefs),
  );
}

// On the far side of the tower as seen from the enemy main hall.
function spotBehind(tower: Point, enemyMain: Point): Point {
  const awayFromEnemyMain = new Vector(enemyMain, tower).normalize();

  return tower.translate(
    awayFromEnemyMain.multiply(HIDING_DISTANCE_BEHIND_TOWER),
  );
}
