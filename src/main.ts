import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3TimerApi from "@lib/warcraft3-api/timer";
import { debug } from "./debug";
import { perceiveWorld } from "./perception/perceive-world";
import { observeAttacksOn } from "./perception/attack-observer";
import { startGameClock } from "./perception/game-clock";
import { installBotPlayer } from "./privileged/install-bot-player";
import { enableDebugMode, updateDebugMode } from "./privileged/debug-mode";
import { createTowerRushContext } from "./strategies/tower-rush/tower-rush-context";
import { updateTowerRush } from "./strategies/tower-rush/tower-rush";

declare function guard(this: void, callback: (this: void) => void): (this: void) => void;

const UPDATE_INTERVAL_SECONDS = 1;
const DEBUG_MODE = true;

/**
 * Entry point called by the runtime wrapper during melee initialization,
 * once per computer player handed over to Warlord AI.
 */
export function main(computerPlayer: W3PlayerApi.player) {
  const bot = installBotPlayer(computerPlayer);

  runAfterMapInitialization(() => play(bot));
}

function play(bot: W3PlayerApi.player) {
  debug(`Bot player id: ${W3PlayerApi.GetPlayerId(bot)}`);

  const towerRush = createTowerRushContext();
  const clock = startGameClock();
  const attackObserver = observeAttacksOn(bot, clock);
  const debugMode = DEBUG_MODE ? enableDebugMode(debugObserver()) : undefined;

  const loop = W3TimerApi.CreateTimer();

  const update = () => {
    const world = perceiveWorld(bot, clock, attackObserver);

    if (world.enemyPlayersPlaying === 0) {
      stopLoop(loop);
      return;
    }

    updateTowerRush(world, towerRush);

    if (debugMode) {
      updateDebugMode(debugMode, bot);
    }
  };

  W3TimerApi.TimerStart(loop, UPDATE_INTERVAL_SECONDS, true, guard(update));
  update();
}

// With every enemy defeated there is nothing left to play for, and the
// strategy cannot run without an enemy.
function stopLoop(loop: W3TimerApi.timer) {
  W3TimerApi.PauseTimer(loop);
  W3TimerApi.DestroyTimer(loop);
  debug("Game won; Warlord AI stops.");
}

// The same player `debug` messages are shown to.
function debugObserver(): W3PlayerApi.player {
  const observer = W3PlayerApi.Player(0);

  if (!observer) {
    throw new Error("Debug mode: observer player not found.");
  }

  return observer;
}

function runAfterMapInitialization(callback: (this: void) => void) {
  const timer = W3TimerApi.CreateTimer();

  W3TimerApi.TimerStart(timer, 0, false, guard(() => {
    W3TimerApi.DestroyTimer(timer);
    callback();
  }));
}
