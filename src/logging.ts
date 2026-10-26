import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import {
  createLogger,
  createLogRecordBuffer,
  type Logger,
  type LogLevelName,
} from '@lib/logger';
import { startWarcraftLogExport } from '@lib/logger/warcraft';
import { readGameClock, startGameClock } from './beliefs/game-clock';
import { debug } from './debug';

export { startLogging };

const LoggingEnabled = true;
const LogLevel: LogLevelName = 'debug';
const BufferCapacity = 4096;
const BatchSize = 256;
const FlushIntervalSeconds = 0.5;
// Relative to Warcraft's CustomMapData folder.
const LogDirectory = 'WarlordLogs';

/**
 * Creates the bot's root logger and starts exporting its records to
 * `CustomMapData/WarlordLogs`, where `npm run collect-logs` picks them up.
 * Every record carries `gameTime`, in game seconds.
 *
 * The session, named after the start time and the bot's player, keeps the
 * logs of every game and bot apart; without a wall clock there is no
 * unique name, and logging stays off.
 */
function startLogging({ bot }: { bot: W3PlayerApi.player }): Logger {
  if (!LoggingEnabled) {
    return createLogger({ enabled: false });
  }

  const startedAt = WarlordApi.readWallClockMilliseconds();

  if (startedAt === undefined) {
    debug({ message: 'Logging is off: Lua offers no wall clock.' });
    return createLogger({ enabled: false });
  }

  const buffer = createLogRecordBuffer({ capacity: BufferCapacity });
  const clock = startGameClock();
  const logger = createLogger({
    level: LogLevel,
    buffer,
    readTime: () => WarlordApi.readWallClockMilliseconds(),
    mixin: () => ({ gameTime: readGameClock({ clock }) }),
  });

  startWarcraftLogExport({
    buffer,
    logger,
    session: `${startedAt}-p${W3PlayerApi.GetPlayerId(bot)}`,
    directory: LogDirectory,
    flushIntervalSeconds: FlushIntervalSeconds,
    batchSize: BatchSize,
  });

  return logger;
}
