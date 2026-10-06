import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3TimerApi from "@lib/warcraft3-api/timer";
import { debug } from "./debug";
import { GlobalBeliefModel, GlobalBeliefs } from "./beliefs/global.beliefs";
import { ApplyPressure } from "./desires/apply-pressure";
import { ProtectEconomicAssets } from "./desires/protect-economic-assets";
import { UseMilitaryAssetsEffectively } from "./desires/use-military-assets-effectively";
import {
  WarlordDeliberation,
  WarlordIntention,
} from "./deliberation/deliberation";
import { installBotPlayer } from "./privileged/install-bot-player";
import { enableDebugMode, updateDebugMode } from "./privileged/debug-mode";

declare function guard(this: void, callback: (this: void) => void): (this: void) => void;

const TICK_SECONDS = 0.1;
const DEBUG_MODE = true;
// Every desire is held for the whole game for now.
const DESIRES = [
  ApplyPressure,
  ProtectEconomicAssets,
  UseMilitaryAssetsEffectively,
];

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

  const beliefModel = new GlobalBeliefModel(bot);
  const deliberation = new WarlordDeliberation();
  const debugMode = DEBUG_MODE ? enableDebugMode(debugObserver()) : undefined;

  let beliefs: GlobalBeliefs | undefined;
  let intentions: readonly WarlordIntention[] = [];
  const loop = W3TimerApi.CreateTimer();

  const tick = () => {
    const current = beliefModel.revise(beliefs, beliefModel.observe());
    beliefs = current;

    if (current.enemyPlayersPlaying === 0) {
      stopLoop(loop);
      return;
    }

    intentions = deliberation.deliberate(current, DESIRES, intentions);

    for (const intention of intentions) {
      intention.update(current);
    }

    if (debugMode) {
      updateDebugMode(debugMode, bot);
    }
  };

  W3TimerApi.TimerStart(loop, TICK_SECONDS, true, guard(tick));
  tick();
}

// With every enemy defeated there is nothing left to play for, and the
// tower rush cannot run without an enemy.
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
