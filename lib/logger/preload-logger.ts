import { createLogger, type LogBindings, type Logger } from './create-logger';
import type { LogLevelName } from './levels';
import {
  createPreloadTransport,
  type PreloadNatives,
} from './preload-transport';
import { createLogRecordBuffer } from './record-buffer';

export { createDisabledLogger, createPreloadLogger };

/** A root logger and the export writing its records to batch files. */
interface PreloadLogger {
  readonly logger: Logger;

  /**
   * Writes up to `batchSize` buffered records to a new batch file, or
   * nothing when none are buffered. Synchronous: `PreloadGenEnd` writes the
   * file on the game thread. Call it periodically, e.g. from a timer.
   */
  exportBatch(): void;
}

interface PreloadLoggerOptions {
  /** The Warcraft natives that write preload files. */
  natives: PreloadNatives;
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
  /**
   * A clock in seconds, such as Lua's `os.clock`, to measure each export.
   * Without it, export reports carry no durations.
   */
  readClockSeconds?: () => number | undefined;
  /** Identifies the log stream in batch files and their names. */
  session: string;
  /** Folder for the batch files, relative to Warcraft's `CustomMapData`. */
  directory: string;
  /** Most records held before new ones are dropped; at least 2. */
  bufferCapacity: number;
  /** Most records written to one batch file. */
  batchSize: number;
}

/**
 * Creates a root logger whose records wait in a bounded buffer until
 * `exportBatch` writes them to a batch file. Each export reports its
 * duration in a `debug` record.
 */
function createPreloadLogger(options: PreloadLoggerOptions): PreloadLogger {
  const buffer = createLogRecordBuffer({ capacity: options.bufferCapacity });
  const logger = createLogger({
    level: options.level,
    buffer,
    readTime: options.readTime,
    mixin: options.mixin,
  });
  const transport = createPreloadTransport({ natives: options.natives })({
    session: options.session,
    directory: options.directory,
  });
  const readClockSeconds = () => options.readClockSeconds?.();

  return {
    logger,

    exportBatch() {
      const startedAt = readClockSeconds();
      const batch = buffer.drain({ maxRecords: options.batchSize });

      if (batch.recordCount === 0) {
        return;
      }

      const formattedAt = readClockSeconds();
      transport.write({ batch });
      const writtenAt = readClockSeconds();

      // A batch holding nothing but the previous batch's report would keep
      // an idle game writing a file every export.
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
    },
  };
}

/** A logger whose calls do nothing. */
function createDisabledLogger(): Logger {
  return createLogger({ enabled: false });
}

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
