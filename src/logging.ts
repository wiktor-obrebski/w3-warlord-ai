import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import {
  createWarcraftLogger,
  type Logger,
  type LogLevelName,
} from '@lib/logger';
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
 * Creates the bot's root logger, exporting its records to
 * `CustomMapData/WarlordLogs`, where `bin/collect-logs` picks them up.
 * Every record carries `gameTime`, in game seconds.
 *
 * The session, named after the start time and the bot's player, keeps the
 * logs of every game and bot apart; without a wall clock there is no
 * unique name, and logging stays off.
 */
function startLogging({ bot }: { bot: W3PlayerApi.player }): Logger {
  if (!LoggingEnabled) {
    return createWarcraftLogger({ enabled: false });
  }

  const startedAt = WarlordApi.readWallClockMillisecondsText();

  if (startedAt === undefined) {
    debug({ message: 'Logging is off: Lua offers no wall clock.' });
    return createWarcraftLogger({ enabled: false });
  }

  const clock = startGameClock();

  return createWarcraftLogger({
    level: LogLevel,
    readTime: () => WarlordApi.readWallClockMillisecondsText(),
    mixin: () => ({ gameTime: readGameClock({ clock }) }),
    session: `${startedAt}-p${W3PlayerApi.GetPlayerId(bot)}`,
    directory: LogDirectory,
    bufferCapacity: BufferCapacity,
    batchSize: BatchSize,
    flushIntervalSeconds: FlushIntervalSeconds,
  });
}
