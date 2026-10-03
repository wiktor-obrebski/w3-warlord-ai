import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3TimerApi from "@lib/warcraft3-api/timer";
import { debug } from "./debug";
import { perceiveWorld } from "./perception/perceive-world";
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
  const debugMode = DEBUG_MODE ? enableDebugMode(debugObserver()) : undefined;

  const update = () => {
    updateTowerRush(perceiveWorld(bot), towerRush);

    if (debugMode) {
      updateDebugMode(debugMode, bot);
    }
  };

  update();

  W3TimerApi.TimerStart(
    W3TimerApi.CreateTimer(),
    UPDATE_INTERVAL_SECONDS,
    true,
    guard(update),
  );
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
