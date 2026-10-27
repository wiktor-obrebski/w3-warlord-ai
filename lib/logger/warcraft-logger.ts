import * as W3PreloadApi from '@lib/warcraft3-api/preload';
import * as W3TimerApi from '@lib/warcraft3-api/timer';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import { createLogger, type LogBindings, type Logger } from './create-logger';
import type { LogLevelName } from './levels';
import {
  createPreloadTransport,
  type PreloadNatives,
} from './preload-transport';
import { createLogRecordBuffer, type LogRecordBuffer } from './record-buffer';

export { createWarcraftLogger };

type WarcraftLoggerOptions = EnabledWarcraftLoggerOptions | { enabled: false };

interface EnabledWarcraftLoggerOptions {
  enabled?: true;
  /** Lowest level recorded; `info` by default. */
  level?: LogLevelName;
  /**
   * Real-world time for `time`, as the decimal digits of milliseconds since
   * the Unix epoch, written as they are. Text, because Warcraft's Lua
   * numbers are 32-bit and cannot hold the number. No `time` is written
   * while it returns `undefined`.
   */
  readTime?: () => string | undefined;
  /**
   * Like Pino's `mixin`: fields added to every record, before the call's
   * own, such as the current game time.
   */
  mixin?: () => LogBindings;
  /** Identifies the log stream in batch files and their names. */
  session: string;
  /** Folder for the batch files, relative to Warcraft's `CustomMapData`. */
  directory: string;
  /** Most records held before new ones are dropped; at least 2. */
  bufferCapacity: number;
  /** Most records written to one batch file. */
  batchSize: number;
  /** Game seconds between exports. */
  flushIntervalSeconds: number;
}

/**
 * Creates a root logger whose records are exported to preload files every
 * flush interval, at most one batch file per export. Records beyond the
 * batch size wait for the next export, which bounds the synchronous work
 * done on one frame; the buffer drops records when they arrive faster than
 * they are exported. Each export reports its duration in a `debug` record.
 *
 * With `enabled: false`, every call is a no-op and nothing is exported.
 */
function createWarcraftLogger(options: WarcraftLoggerOptions): Logger {
  if (options.enabled === false) {
    return createLogger({ enabled: false });
  }

  const buffer = createLogRecordBuffer({ capacity: options.bufferCapacity });
  const logger = createLogger({
    level: options.level,
    buffer,
    readTime: options.readTime,
    mixin: options.mixin,
  });

  startExport({
    buffer,
    logger,
    session: options.session,
    directory: options.directory,
    batchSize: options.batchSize,
    flushIntervalSeconds: options.flushIntervalSeconds,
  });

  return logger;
}

interface StartExportArgs {
  buffer: LogRecordBuffer;
  logger: Logger;
  session: string;
  directory: string;
  batchSize: number;
  flushIntervalSeconds: number;
}

function startExport({
  buffer,
  logger,
  session,
  directory,
  batchSize,
  flushIntervalSeconds,
}: StartExportArgs) {
  const transport = createPreloadTransport({ natives: WarcraftPreloadNatives })(
    { session, directory }
  );

  const exportBatch = () => {
    const startedAt = WarlordApi.readClockSeconds();
    const batch = buffer.drain({ maxRecords: batchSize });

    if (batch.recordCount === 0) {
      return;
    }

    const formattedAt = WarlordApi.readClockSeconds();
    transport.write({ batch });
    const writtenAt = WarlordApi.readClockSeconds();

    // A batch holding nothing but the previous batch's report would keep an
    // idle game writing a file every interval.
    if (batch.recordCount > 1 && logger.isLevelEnabled('debug')) {
      logger.debug(
        {
          records: batch.recordCount,
          bytes: batch.jsonl.length,
          formatMs: elapsedMilliseconds({ from: startedAt, to: formattedAt }),
          writeMs: elapsedMilliseconds({ from: formattedAt, to: writtenAt }),
        },
        'Log batch exported'
      );
    }
  };

  W3TimerApi.TimerStart(
    W3TimerApi.CreateTimer(),
    flushIntervalSeconds,
    true,
    WarlordApi.guard(exportBatch)
  );
}

const WarcraftPreloadNatives: PreloadNatives = {
  preloadGenClear: () => W3PreloadApi.PreloadGenClear(),
  preloadGenStart: () => W3PreloadApi.PreloadGenStart(),
  preload: (text) => W3PreloadApi.Preload(text),
  preloadGenEnd: (fileName) => W3PreloadApi.PreloadGenEnd(fileName),
};

interface ElapsedMillisecondsArgs {
  from: number | undefined;
  to: number | undefined;
}

// Between two clock readings in seconds, rounded to 0.01 ms.
function elapsedMilliseconds({
  from,
  to,
}: ElapsedMillisecondsArgs): number | undefined {
  return from === undefined || to === undefined
    ? undefined
    : Math.round((to - from) * 100_000) / 100;
}
