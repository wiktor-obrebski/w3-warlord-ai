import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { Point, VisibleEnemy } from "../../perception/world-state";
import {
  AttackObserver,
  isRecentlyAttacked,
} from "../../perception/attack-observer";
import { GameClock, readGameClock } from "../../perception/game-clock";
import {
  enemyPlayers,
  isUnitAlive,
  unitsOfPlayer,
  visibleEnemies,
} from "../../perception/perceive-world";

const NO_ORDER = 0;

export interface ObservedWorker {
  unit: W3UnitApi.unit;
  position: Point;
  isIdle: boolean;
  isAttacked: boolean;
}

export interface WorkerSafetyPerception {
  // Game seconds since the bot started playing.
  time: number;
  workers: ObservedWorker[];
  // Only collected while a worker is attacked.
  visibleEnemies: VisibleEnemy[];
}

/**
 * The observations worker safety needs, kept small because it runs much more
 * often than the full world perception.
 */
export function perceiveWorkerSafety(
  bot: W3PlayerApi.player,
  clock: GameClock,
  attackObserver: AttackObserver,
): WorkerSafetyPerception {
  const workers = unitsOfPlayer(bot)
    .filter(
      (unit) =>
        isUnitAlive(unit) && W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_PEON),
    )
    .map((unit) => ({
      unit,
      position: { x: W3UnitApi.GetUnitX(unit), y: W3UnitApi.GetUnitY(unit) },
      isIdle: W3UnitApi.GetUnitCurrentOrder(unit) === NO_ORDER,
      isAttacked: isRecentlyAttacked(attackObserver, unit),
    }));
  const anyWorkerAttacked = workers.some((worker) => worker.isAttacked);

  return {
    time: readGameClock(clock),
    workers,
    visibleEnemies: anyWorkerAttacked
      ? visibleEnemies(bot, enemyPlayers(bot), attackObserver)
      : [],
  };
}
