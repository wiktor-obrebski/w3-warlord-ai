import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3TimerApi from "@lib/warcraft3-api/timer";
import * as WarlordApi from "@lib/warcraft3-api/warlord";
import { debug } from "./debug";
import { startRuntime } from "./runtime";
import { installBotPlayer } from "./privileged/install-bot-player";
import { enableDebugMode, updateDebugMode } from "./privileged/debug-mode";

const DEBUG_MODE = true;
const DEBUG_MODE_UPDATE_SECONDS = 0.1;

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

  if (DEBUG_MODE) {
    startDebugMode(bot);
  }

  startRuntime(bot);
}

function startDebugMode(bot: W3PlayerApi.player) {
  const debugMode = enableDebugMode(debugObserver());
  const timer = W3TimerApi.CreateTimer();

  W3TimerApi.TimerStart(
    timer,
    DEBUG_MODE_UPDATE_SECONDS,
    true,
    WarlordApi.guard(() => updateDebugMode(debugMode, bot)),
  );
  updateDebugMode(debugMode, bot);
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

  W3TimerApi.TimerStart(timer, 0, false, WarlordApi.guard(() => {
    W3TimerApi.DestroyTimer(timer);
    callback();
  }));
}
