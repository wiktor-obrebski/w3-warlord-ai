import {
  appendCapturedFields,
  captureFields,
  type CapturedFields,
} from './captured-fields';
import { isErrorLike } from './err-serializer';
import { createJsonTextCache } from './json-text-cache';
import { LOG_LEVELS, type LogLevelName } from './levels';
import type { LogRecordBuffer } from './record-buffer';

export { createLogger, type LogBindings, type Logger, type LoggerOptions };

type LogBindings = Readonly<Record<string, unknown>>;

/**
 * A Pino-like logger writing records into a `LogRecordBuffer`. Calls do no
 * I/O: they snapshot their fields and store the record.
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
}

type LoggerOptions = EnabledLoggerOptions | { enabled: false };

interface EnabledLoggerOptions {
  enabled?: true;
  /** Lowest level recorded; `info` by default. */
  level?: LogLevelName;
  buffer: LogRecordBuffer;
  /**
   * Real-world time for `time`, in milliseconds since the Unix epoch; no
   * `time` is written while it returns `undefined`.
   */
  readTime?: () => number | undefined;
  /**
   * Like Pino's `mixin`: fields added to every record, before the call's
   * own, such as the current game time.
   */
  mixin?: () => LogBindings;
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
  const core: LoggerCore = {
    level,
    threshold: LOG_LEVELS[level],
    buffer: options.buffer,
    readTime: options.readTime,
    mixin: options.mixin,
  };

  return new BufferedLogger({ core, bindings: '' });
}

interface LoggerCore {
  level: LogLevelName;
  threshold: number;
  buffer: LogRecordBuffer | undefined;
  readTime: (() => number | undefined) | undefined;
  mixin: (() => LogBindings) | undefined;
}

const DisabledCore: LoggerCore = {
  level: 'silent',
  threshold: LOG_LEVELS.silent,
  buffer: undefined,
  readTime: undefined,
  mixin: undefined,
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

function formatBindings({ captured }: { captured: CapturedFields }): string {
  const parts: string[] = [];

  appendCapturedFields(parts, captured, createJsonTextCache());
  return parts.join('');
}
