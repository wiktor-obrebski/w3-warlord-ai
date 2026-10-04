import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { debug } from "../../debug";
import { Point, VisibleEnemy, WorldState } from "../../perception/world-state";
import { ForwardWorkerSafety, TowerRushContext } from "./tower-rush-context";
import {
  distanceBetween,
  forgetSentToSafety,
  positionOf,
} from "./forward-workers";

const FLEE_ROUND_DISTANCE = 300;
const SAFE_AFTER_ATTACK_SECONDS = 2;
// Not tuned in-game.
const THREAT_RADIUS = 1000;
const FLEE_DESTINATION_REACHED_DISTANCE = 32;

export enum ForwardWorkerStatus {
  Fleeing,
  // No longer attacked, but not yet safe for long enough to return to duty.
  Recovering,
  Safe,
}

// Being attacked overrides every other duty of the worker. Each flee round
// runs a fixed distance to a destination kept until the round ends, so the
// worker is not turned around on every update as the enemies move.
export function protectForwardWorker(
  worker: W3UnitApi.unit,
  world: WorldState,
  enemyMain: Point,
  context: TowerRushContext,
): ForwardWorkerStatus {
  const safety = safetyOf(worker, context);
  const attackers = world.visibleEnemies.filter(
    (enemy) => enemy.attackTarget === worker,
  );
  const attacked = attackers.length > 0;

  if (attacked) {
    safety.lastAttackedAt = world.time;
  }

  if (safety.fleeDestination) {
    if (!fleeRoundFinished(worker, safety.fleeDestination, world)) {
      return ForwardWorkerStatus.Fleeing;
    }

    safety.fleeDestination = undefined;

    if (!attacked) {
      debug("Tower rush: forward Peasant is no longer attacked.");
    }
  }

  if (attacked) {
    startFleeRound(worker, attackers, world, enemyMain, safety, context);
    return ForwardWorkerStatus.Fleeing;
  }

  return isSafe(safety, world)
    ? ForwardWorkerStatus.Safe
    : ForwardWorkerStatus.Recovering;
}

function safetyOf(
  worker: W3UnitApi.unit,
  context: TowerRushContext,
): ForwardWorkerSafety {
  let safety = context.forwardWorkerSafety.find(
    (entry) => entry.worker === worker,
  );

  if (!safety) {
    safety = { worker };
    context.forwardWorkerSafety.push(safety);
  }

  return safety;
}

// An unreachable destination ends the move short of it, leaving the worker
// idle.
function fleeRoundFinished(
  worker: W3UnitApi.unit,
  destination: Point,
  world: WorldState,
): boolean {
  return (
    world.idleUnits.includes(worker) ||
    distanceBetween(positionOf(worker), destination) <=
      FLEE_DESTINATION_REACHED_DISTANCE
  );
}

function startFleeRound(
  worker: W3UnitApi.unit,
  attackers: VisibleEnemy[],
  world: WorldState,
  enemyMain: Point,
  safety: ForwardWorkerSafety,
  context: TowerRushContext,
) {
  const position = positionOf(worker);
  const threats = nearbyThreats(position, world);
  const enemyCenter = averagePosition(threats.length > 0 ? threats : attackers);
  const destination = pointAwayFrom(
    position,
    // Standing on the worker, the enemy center gives no direction.
    distanceBetween(position, enemyCenter) > 0 ? enemyCenter : enemyMain,
    FLEE_ROUND_DISTANCE,
  );

  if (W3UnitApi.IssuePointOrder(worker, "move", destination.x, destination.y)) {
    safety.fleeDestination = destination;
    forgetSentToSafety(worker, context);
    debug(
      `Tower rush: attacked forward Peasant flees from ${threats.length} nearby enemies.`,
    );
  } else {
    debug("Tower rush: flee order rejected.");
  }
}

// The enemy force fighting at the towers: combat units and the Ancients
// that walk into the fight.
function nearbyThreats(position: Point, world: WorldState): VisibleEnemy[] {
  return world.visibleEnemies.filter(
    (enemy) =>
      (enemy.isUprootedAncient ||
        (!enemy.isStructure &&
          !enemy.isWorker &&
          (enemy.isMelee || enemy.isRanged))) &&
      distanceBetween(position, enemy.position) <= THREAT_RADIUS,
  );
}

function averagePosition(enemies: VisibleEnemy[]): Point {
  let x = 0;
  let y = 0;

  for (const enemy of enemies) {
    x += enemy.position.x;
    y += enemy.position.y;
  }

  return { x: x / enemies.length, y: y / enemies.length };
}

function pointAwayFrom(from: Point, threat: Point, distance: number): Point {
  const length = distanceBetween(threat, from);

  return {
    x: from.x + ((from.x - threat.x) / length) * distance,
    y: from.y + ((from.y - threat.y) / length) * distance,
  };
}

function isSafe(safety: ForwardWorkerSafety, world: WorldState): boolean {
  return (
    safety.lastAttackedAt === undefined ||
    world.time - safety.lastAttackedAt >= SAFE_AFTER_ATTACK_SECONDS
  );
}
