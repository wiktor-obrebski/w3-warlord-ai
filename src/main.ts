import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3TimerApi from '@lib/warcraft3-api/timer';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import { debug } from './debug';
import { startRuntime } from './runtime';
import { installBotPlayer } from './privileged/install-bot-player';
import { enableDebugMode, updateDebugMode } from './privileged/debug-mode';

export { main };

const DebugModeEnabled = true;
const DebugModeUpdateSeconds = 0.1;

/**
 * Entry point called by the runtime wrapper during melee initialization,
 * once per computer player handed over to Warlord AI.
 */
function main(computerPlayer: W3PlayerApi.player) {
  const bot = installBotPlayer({ computerPlayer });

  runAfterMapInitialization({ callback: () => play({ bot }) });
}

function play({ bot }: { bot: W3PlayerApi.player }) {
  debug({ message: `Bot player id: ${W3PlayerApi.GetPlayerId(bot)}` });

  if (DebugModeEnabled) {
    startDebugMode({ bot });
  }

  startRuntime({ bot });
}

function startDebugMode({ bot }: { bot: W3PlayerApi.player }) {
  const debugMode = enableDebugMode({ observer: debugObserver() });
  const timer = W3TimerApi.CreateTimer();

  W3TimerApi.TimerStart(
    timer,
    DebugModeUpdateSeconds,
    true,
    WarlordApi.guard(() => updateDebugMode({ debugMode, bot }))
  );
  updateDebugMode({ debugMode, bot });
}

// The same player `debug` messages are shown to.
function debugObserver(): W3PlayerApi.player {
  const observer = W3PlayerApi.Player(0);

  if (!observer) {
    throw new Error('Debug mode: observer player not found.');
  }

  return observer;
}

interface RunAfterMapInitializationArgs {
  callback: (this: void) => void;
}

function runAfterMapInitialization({
  callback,
}: RunAfterMapInitializationArgs) {
  const timer = W3TimerApi.CreateTimer();

  W3TimerApi.TimerStart(
    timer,
    0,
    false,
    WarlordApi.guard(() => {
      W3TimerApi.DestroyTimer(timer);
      callback();
    })
  );
}
