import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3PreloadApi from '@lib/warcraft3-api/preload';
import * as W3TimerApi from '@lib/warcraft3-api/timer';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import {
  createLogger,
  createPreloadTransport,
  type Logger,
  type LogLevelName,
  type PreloadNatives,
} from '@lib/logger';
import { GameClock, readGameClock, startGameClock } from './game-clock';
import { debug } from './debug';

export { type BotLoggers, startLogging };

interface BotLoggers {
  // The bot's root logger.
  readonly logger: Logger;
  // The decision record's logger, writing to files of its own.
  readonly recordLogger: Logger;
}

const LoggingEnabled = true;
const LogLevel: LogLevelName = 'debug';
const BufferCapacity = 4096;
const BatchSize = 256;
const FlushIntervalSeconds = 0.5;
// Relative to Warcraft's CustomMapData folder.
const LogDirectory = 'Warlord/Logs';
const RecordDirectory = 'Warlord/DecisionRecord';
const RecordSessionSuffix = '-record';

/**
 * Creates the bot's root logger and the decision record's logger, and
 * flushes their records every half game second, each logger to a folder of
 * its own in `CustomMapData/Warlord`, where `bin/collect-logs` picks them up.
 * Every record carries `gameTime`, in game seconds. From then on, every error
 * the runtime wrapper shows in-game is logged too.
 *
 * The session, named after the start time and the bot's player, keeps the
 * logs of every game and bot apart. The record's session adds a suffix to it,
 * so the record's lines stay apart from the game log's even when both are
 * collected into one stream. Without a wall clock there is no unique name,
 * and logging stays off.
 */
function startLogging({ bot }: { bot: W3PlayerApi.player }): BotLoggers {
  if (!LoggingEnabled) {
    return disabledLoggers();
  }

  const startedAt = WarlordApi.readWallClockMillisecondsText();

  if (startedAt === undefined) {
    debug({ message: 'Logging is off: Lua offers no wall clock.' });
    return disabledLoggers();
  }

  const clock = startGameClock();
  const session = `${startedAt}-p${W3PlayerApi.GetPlayerId(bot)}`;
  const logger = createBotLogger({
    session,
    directory: LogDirectory,
    clock,
  });
  const recordLogger = createBotLogger({
    session: `${session}${RecordSessionSuffix}`,
    directory: RecordDirectory,
    clock,
  });

  W3TimerApi.TimerStart(
    W3TimerApi.CreateTimer(),
    FlushIntervalSeconds,
    true,
    WarlordApi.guard(() => {
      logger.flush();
      recordLogger.flush();
    })
  );
  WarlordApi.setErrorListener((message) =>
    logger.error({ err: message }, 'Uncaught error')
  );

  return { logger, recordLogger };
}

function disabledLoggers(): BotLoggers {
  return {
    logger: createLogger({ enabled: false }),
    recordLogger: createLogger({ enabled: false }),
  };
}

interface CreateBotLoggerArgs {
  session: string;
  directory: string;
  clock: GameClock;
}

function createBotLogger({
  session,
  directory,
  clock,
}: CreateBotLoggerArgs): Logger {
  return createLogger({
    level: LogLevel,
    transport: createPreloadTransport({ natives: WarcraftPreloadNatives })({
      session,
      directory,
    }),
    bufferCapacity: BufferCapacity,
    batchSize: BatchSize,
    readTime: () => WarlordApi.readWallClockMillisecondsText(),
    mixin: () => ({ gameTime: readGameClock({ clock }) }),
    readClockSeconds: () => WarlordApi.readClockSeconds(),
  });
}

const WarcraftPreloadNatives: PreloadNatives = {
  preloadGenClear: () => W3PreloadApi.PreloadGenClear(),
  preloadGenStart: () => W3PreloadApi.PreloadGenStart(),
  preload: (text) => W3PreloadApi.Preload(text),
  preloadGenEnd: (fileName) => W3PreloadApi.PreloadGenEnd(fileName),
};
