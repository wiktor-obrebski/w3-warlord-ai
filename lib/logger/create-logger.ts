import {
  appendCapturedFields,
  captureFields,
  type CapturedFields,
} from './captured-fields';
import { isErrorLike } from './err-serializer';
import { createJsonTextCache } from './json-text-cache';
import { LOG_LEVELS, type LogLevelName } from './levels';
import type { LogTransport } from './log-transport';
import { createLogRecordBuffer, type LogRecordBuffer } from './record-buffer';

export { createLogger, type LogBindings, type Logger, type LoggerOptions };

type LogBindings = Readonly<Record<string, unknown>>;

/**
 * A Pino-like logger. Calls do no I/O: they snapshot their fields and store
 * the record in a bounded buffer, shared by a root logger and its
 * children, which `flush` writes to the transport.
 *
 * A call below the logger's level returns at once, but its arguments,
 * such as an object literal, are still built by the caller: guard
 * frequent calls whose arguments are costly with `isLevelEnabled`.
 */
interface Logger {
  readonly level: LogLevelName;

  trace(message: string): void;
  trace(fields: object, message?: string): void;
  debug(message: string): void;
  debug(fields: object, message?: string): void;
  info(message: string): void;
  info(fields: object, message?: string): void;
  warn(message: string): void;
  warn(fields: object, message?: string): void;
  error(message: string): void;
  error(fields: object, message?: string): void;
  fatal(message: string): void;
  fatal(fields: object, message?: string): void;

  /** A logger adding `bindings` to each record, after its parent's. */
  child(bindings: LogBindings): Logger;

  isLevelEnabled(level: LogLevelName): boolean;

  /**
   * Writes up to `batchSize` of the oldest buffered records to the
   * transport as one batch, or nothing when none are buffered. Synchronous;
   * call it periodically, e.g. from a timer. Each flush that writes reports
   * its duration in a `debug` record.
   */
  flush(): void;
}

/** With `enabled: false`, every call does nothing. */
type LoggerOptions = EnabledLoggerOptions | { enabled: false };

interface EnabledLoggerOptions {
  enabled?: true;
  /** Lowest level recorded; `info` by default. */
  level?: LogLevelName;
  /** Where `flush` writes batches of records. */
  transport: LogTransport;
  /** Most records held before new ones are dropped; at least 2. */
  bufferCapacity: number;
  /** Most records written by one `flush`. */
  batchSize: number;
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
   * A clock in seconds, such as Lua's `os.clock`, to measure each flush.
   * Without it, flush reports carry no durations.
   */
  readClockSeconds?: () => number | undefined;
}

/**
 * Creates a root logger. Records an `Error` passed in place of fields as
 * `err` and, without a message, takes the error's message, as Pino does.
 */
function createLogger(options: LoggerOptions): Logger {
  if (options.enabled === false) {
    return new BufferedLogger({ core: DisabledCore, bindings: '' });
  }

  const level = options.level ?? 'info';
  const buffer = createLogRecordBuffer({ capacity: options.bufferCapacity });
  const core: LoggerCore = {
    level,
    threshold: LOG_LEVELS[level],
    buffer,
    readTime: options.readTime,
    mixin: options.mixin,
    flush() {
      flushBatch({ options, buffer, logger });
    },
  };
  const logger = new BufferedLogger({ core, bindings: '' });

  return logger;
}

interface LoggerCore {
  level: LogLevelName;
  threshold: number;
  buffer: LogRecordBuffer | undefined;
  readTime: (() => string | undefined) | undefined;
  mixin: (() => LogBindings) | undefined;
  flush(): void;
}

const DisabledCore: LoggerCore = {
  level: 'silent',
  threshold: LOG_LEVELS.silent,
  buffer: undefined,
  readTime: undefined,
  mixin: undefined,
  flush() {},
};

interface BufferedLoggerConstructorArgs {
  core: LoggerCore;
  // The JSON members of all bindings, each preceded by a comma.
  bindings: string;
}

class BufferedLogger implements Logger {
  readonly level: LogLevelName;
  private readonly core: LoggerCore;
  private readonly threshold: number;
  private readonly bindings: string;

  constructor({ core, bindings }: BufferedLoggerConstructorArgs) {
    this.core = core;
    this.level = core.level;
    this.threshold = core.threshold;
    this.bindings = bindings;
  }

  trace(first: object | string, message?: string) {
    if (this.threshold <= LOG_LEVELS.trace) {
      this.write(LOG_LEVELS.trace, first, message);
    }
  }

  debug(first: object | string, message?: string) {
    if (this.threshold <= LOG_LEVELS.debug) {
      this.write(LOG_LEVELS.debug, first, message);
    }
  }

  info(first: object | string, message?: string) {
    if (this.threshold <= LOG_LEVELS.info) {
      this.write(LOG_LEVELS.info, first, message);
    }
  }

  warn(first: object | string, message?: string) {
    if (this.threshold <= LOG_LEVELS.warn) {
      this.write(LOG_LEVELS.warn, first, message);
    }
  }

  error(first: object | string, message?: string) {
    if (this.threshold <= LOG_LEVELS.error) {
      this.write(LOG_LEVELS.error, first, message);
    }
  }

  fatal(first: object | string, message?: string) {
    if (this.threshold <= LOG_LEVELS.fatal) {
      this.write(LOG_LEVELS.fatal, first, message);
    }
  }

  child(bindings: LogBindings): Logger {
    if (this.core.buffer === undefined) {
      return this;
    }

    const captured: CapturedFields = [];
    captureFields(bindings, captured, 0);

    return new BufferedLogger({
      core: this.core,
      bindings: this.bindings + formatBindings({ captured }),
    });
  }

  isLevelEnabled(level: LogLevelName): boolean {
    return level !== 'silent' && this.threshold <= LOG_LEVELS[level];
  }

  flush() {
    this.core.flush();
  }

  // Positional parameters: an argument object would allocate a Lua table on
  // every log call.
  private write(level: number, first: object | string, message?: string) {
    const core = this.core;
    let fields: CapturedFields | undefined;
    let fieldCount = 0;

    if (core.mixin !== undefined) {
      fields = [];
      fieldCount = captureFields(core.mixin(), fields, fieldCount);
    }

    if (typeof first === 'string') {
      message = first;
    } else {
      fields ??= [];

      if (first instanceof Error) {
        fieldCount = captureFields({ err: first }, fields, fieldCount);
        message ??= first.message;
      } else {
        fieldCount = captureFields(first, fields, fieldCount);

        // Pino takes the message of an `err` field when the call has none.
        const { err, msg } = first as { err?: unknown; msg?: unknown };
        if (message === undefined && msg === undefined && isErrorLike(err)) {
          message = err.message;
        }
      }
    }

    // Not passed inline: TSTL spreads an argument list holding an optional
    // call through a temporary table.
    const time = core.readTime === undefined ? undefined : core.readTime();

    core.buffer!.append(
      level,
      time,
      this.bindings,
      fieldCount > 0 ? fields : undefined,
      message
    );
  }
}

interface FlushBatchArgs {
  options: EnabledLoggerOptions;
  buffer: LogRecordBuffer;
  logger: Logger;
}

function flushBatch({ options, buffer, logger }: FlushBatchArgs) {
  const readClockSeconds = () => options.readClockSeconds?.();
  const startedAt = readClockSeconds();
  const batch = buffer.drain({ maxRecords: options.batchSize });

  if (batch.recordCount === 0) {
    return;
  }

  const formattedAt = readClockSeconds();
  options.transport.write({ batch });
  const writtenAt = readClockSeconds();

  // A batch holding nothing but the previous batch's report would keep an
  // idle game writing a file every flush.
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

function formatBindings({ captured }: { captured: CapturedFields }): string {
  const parts: string[] = [];

  appendCapturedFields(parts, captured, createJsonTextCache());
  return parts.join('');
}
