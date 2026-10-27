import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3PreloadApi from '@lib/warcraft3-api/preload';
import * as W3TimerApi from '@lib/warcraft3-api/timer';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import {
  createDisabledLogger,
  createPreloadLogger,
  type Logger,
  type LogLevelName,
  type PreloadNatives,
} from '@lib/logger';
import { readGameClock, startGameClock } from './beliefs/game-clock';
import { debug } from './debug';

export { startLogging };

const LoggingEnabled = true;
const LogLevel: LogLevelName = 'debug';
const BufferCapacity = 4096;
const BatchSize = 256;
const ExportIntervalSeconds = 0.5;
// Relative to Warcraft's CustomMapData folder.
const LogDirectory = 'WarlordLogs';

/**
 * Creates the bot's root logger and exports its records every half game
 * second to `CustomMapData/WarlordLogs`, where `bin/collect-logs` picks them
 * up. Every record carries `gameTime`, in game seconds.
 *
 * The session, named after the start time and the bot's player, keeps the
 * logs of every game and bot apart; without a wall clock there is no
 * unique name, and logging stays off.
 */
function startLogging({ bot }: { bot: W3PlayerApi.player }): Logger {
  if (!LoggingEnabled) {
    return createDisabledLogger();
  }

  const startedAt = WarlordApi.readWallClockMillisecondsText();

  if (startedAt === undefined) {
    debug({ message: 'Logging is off: Lua offers no wall clock.' });
    return createDisabledLogger();
  }

  const clock = startGameClock();
  const preloadLogger = createPreloadLogger({
    natives: WarcraftPreloadNatives,
    level: LogLevel,
    readTime: () => WarlordApi.readWallClockMillisecondsText(),
    mixin: () => ({ gameTime: readGameClock({ clock }) }),
    readClockSeconds: () => WarlordApi.readClockSeconds(),
    session: `${startedAt}-p${W3PlayerApi.GetPlayerId(bot)}`,
    directory: LogDirectory,
    bufferCapacity: BufferCapacity,
    batchSize: BatchSize,
  });

  W3TimerApi.TimerStart(
    W3TimerApi.CreateTimer(),
    ExportIntervalSeconds,
    true,
    WarlordApi.guard(() => preloadLogger.exportBatch())
  );

  return preloadLogger.logger;
}

const WarcraftPreloadNatives: PreloadNatives = {
  preloadGenClear: () => W3PreloadApi.PreloadGenClear(),
  preloadGenStart: () => W3PreloadApi.PreloadGenStart(),
  preload: (text) => W3PreloadApi.Preload(text),
  preloadGenEnd: (fileName) => W3PreloadApi.PreloadGenEnd(fileName),
};
