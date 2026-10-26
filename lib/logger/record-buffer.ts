import { appendCapturedFields, type CapturedFields } from './captured-fields';
import { formatJsonNumber } from './json';
import { createJsonTextCache } from './json-text-cache';
import { LOG_LEVELS } from './levels';

export { createLogRecordBuffer, type LogRecordBatch, type LogRecordBuffer };

/**
 * A bounded, ordered store of captured log records, written as Pino JSON
 * lines when drained.
 *
 * Every record passing its logger's level gets the next `seq`, so `seq`
 * orders the records of one buffer and reveals any gap. A full buffer drops
 * new records, keeping the older ones it holds, and counts them. Once at
 * least two slots are free again, a `warn` record reporting the dropped
 * range is stored before the next record.
 */
interface LogRecordBuffer {
  /**
   * Stores a record; called by loggers. Takes positional parameters, since
   * an argument object would allocate a Lua table on every log call.
   *
   * @param time The JSON number text of `time`.
   * @param bindings The logger's bindings as JSON members, each preceded
   *   by a comma.
   */
  append(
    level: number,
    time: string | undefined,
    bindings: string,
    fields: CapturedFields | undefined,
    message: string | undefined
  ): void;

  /** Removes and formats up to `maxRecords` of the oldest records. */
  drain({ maxRecords }: { maxRecords: number }): LogRecordBatch;
}

/** Records formatted as Pino JSON lines, in `seq` order. */
interface LogRecordBatch {
  /** Each record's JSON followed by `\n`. */
  readonly jsonl: string;
  readonly recordCount: number;
}

/** @param capacity Maximum number of records held; at least 2. */
function createLogRecordBuffer({
  capacity,
}: {
  capacity: number;
}): LogRecordBuffer {
  if (!(capacity >= 2)) {
    throw new Error(
      `Log record buffer: capacity must be at least 2, got ${capacity}.`
    );
  }

  // One array per record property: a table per record would add an
  // allocation to every log call.
  const levels: number[] = [];
  const times: (string | undefined)[] = [];
  const sequenceNumbers: number[] = [];
  const recordBindings: string[] = [];
  const recordFields: (CapturedFields | undefined)[] = [];
  const messages: (string | undefined)[] = [];
  let oldestSlot = 0;
  let recordCount = 0;
  let nextSeq = 1;
  let droppedCount = 0;
  let firstDroppedSeq = 0;
  const textCache = createJsonTextCache();

  const store = (
    level: number,
    time: string | undefined,
    bindings: string,
    fields: CapturedFields | undefined,
    message: string | undefined
  ) => {
    const slot = (oldestSlot + recordCount) % capacity;

    levels[slot] = level;
    times[slot] = time;
    sequenceNumbers[slot] = nextSeq;
    recordBindings[slot] = bindings;
    recordFields[slot] = fields;
    messages[slot] = message;
    recordCount += 1;
    nextSeq += 1;
  };

  const drop = () => {
    if (droppedCount === 0) {
      firstDroppedSeq = nextSeq;
    }
    droppedCount += 1;
    nextSeq += 1;
  };

  const storeDropSummary = (time: string | undefined) => {
    store(
      LOG_LEVELS.warn,
      time,
      '',
      [
        'dropped',
        droppedCount,
        'firstDroppedSeq',
        firstDroppedSeq,
        'lastDroppedSeq',
        firstDroppedSeq + droppedCount - 1,
      ],
      'Log records dropped: buffer full'
    );
    droppedCount = 0;
  };

  return {
    append(level, time, bindings, fields, message) {
      if (droppedCount > 0) {
        if (recordCount > capacity - 2) {
          drop();
          return;
        }
        storeDropSummary(time);
      } else if (recordCount === capacity) {
        drop();
        return;
      }

      store(level, time, bindings, fields, message);
    },

    drain({ maxRecords }) {
      const drained = Math.min(maxRecords, recordCount);
      const parts: string[] = [];

      // Pushes one part at a time: TSTL turns a push of several into a call
      // allocating a table.
      for (let index = 0; index < drained; index++) {
        const slot = (oldestSlot + index) % capacity;
        const time = times[slot];
        const fields = recordFields[slot];
        const message = messages[slot];

        parts.push('{"level":');
        parts.push(formatJsonNumber(levels[slot]!));
        if (time !== undefined) {
          parts.push(',"time":');
          parts.push(time);
        }
        parts.push(',"seq":');
        parts.push(formatJsonNumber(sequenceNumbers[slot]!));
        parts.push(recordBindings[slot]!);
        if (fields !== undefined) {
          appendCapturedFields(parts, fields, textCache);
        }
        if (message !== undefined) {
          parts.push(',"msg":');
          parts.push(textCache.quoted(message));
        }
        parts.push('}\n');

        // Release what the record references.
        recordFields[slot] = undefined;
        messages[slot] = undefined;
      }

      oldestSlot = (oldestSlot + drained) % capacity;
      recordCount -= drained;

      return { jsonl: parts.join(''), recordCount: drained };
    },
  };
}
