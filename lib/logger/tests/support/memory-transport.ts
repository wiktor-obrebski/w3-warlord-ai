import type { LogTransport } from '../../core/log-transport';
import type { LogRecordBatch } from '../../core/record-buffer';

export { createMemoryTransport, type MemoryTransport };

/** A transport keeping every batch written to it. Portable. */
interface MemoryTransport extends LogTransport {
  readonly batches: LogRecordBatch[];
  /** The JSON lines of every batch, in order. */
  readLines(): string[];
}

function createMemoryTransport(): MemoryTransport {
  const batches: LogRecordBatch[] = [];

  return {
    batches,

    write({ batch }) {
      batches.push(batch);
    },

    readLines() {
      const lines: string[] = [];

      for (const batch of batches) {
        for (const line of batch.jsonl.split('\n')) {
          if (line !== '') {
            lines.push(line);
          }
        }
      }

      return lines;
    },
  };
}
