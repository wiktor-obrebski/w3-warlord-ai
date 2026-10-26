import type { LogRecordBatch } from './record-buffer';

export { type LogTransport };

/**
 * Writes drained record batches out of the game, in the order received.
 * Loggers never see it, so it can be replaced without changing them.
 */
interface LogTransport {
  write({ batch }: { batch: LogRecordBatch }): void;
}
