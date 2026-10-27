import type { LogRecordBatch } from './record-buffer';

export { type LogTransport };

/**
 * Writes the batches of records a logger flushes, in the order received.
 * A batch's `jsonl` holds each record's Pino JSON followed by `\n`.
 */
interface LogTransport {
  write({ batch }: { batch: LogRecordBatch }): void;
}
