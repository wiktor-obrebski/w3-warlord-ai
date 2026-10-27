import { createLogger, type Logger } from '../create-logger';
import type { LogTransport } from '../log-transport';
import {
  createPreloadTransport,
  type PreloadNatives,
} from '../preload-transport';
import type { LogRecordBatch } from '../record-buffer';

export { runLoggerBenchmarks, type BenchmarkResult };

interface BenchmarkResult {
  name: string;
  operations: number;
  seconds: number;
}

interface RunLoggerBenchmarksArgs {
  /** A monotonic clock in seconds. */
  readSeconds: () => number;
  report: ({ result }: { result: BenchmarkResult }) => void;
}

/**
 * Measures the logger in whichever runtime runs it; portable, so the same
 * benchmarks run in Node and, compiled by TSTL, in standalone Lua. Neither
 * measures Warcraft: the flush's in-game cost is reported by the
 * `Log batch exported` debug records.
 */
function runLoggerBenchmarks({ readSeconds, report }: RunLoggerBenchmarksArgs) {
  const time = ({ run }: { run: () => void }): number => {
    const startedAt = readSeconds();
    run();
    return readSeconds() - startedAt;
  };

  const repeat = ({ name, log }: { name: string; log: () => void }) => {
    report({
      result: {
        name,
        operations: CallCount,
        seconds: time({
          run: () => {
            for (let index = 0; index < CallCount; index++) {
              log();
            }
          },
        }),
      },
    });
  };

  // Flushes between rounds, outside the measured time, so that every call
  // records instead of being dropped by a full buffer.
  const repeatRecording = ({ name, log, logger }: RepeatRecordingArgs) => {
    let seconds = 0;

    for (let round = 0; round < CallCount / BatchSize; round++) {
      seconds += time({
        run: () => {
          for (let index = 0; index < BatchSize; index++) {
            log();
          }
        },
      });
      logger.flush();
    }

    report({ result: { name, operations: CallCount, seconds } });
  };

  const disabled = createBenchmarkLogger({ mixin: false });
  repeat({
    name: 'disabled level, message only',
    log: () => disabled.logger.trace('Evaluating target'),
  });
  repeat({
    name: 'disabled level, fields object built by the caller',
    log: () =>
      disabled.logger.trace({ unitId: 3, targetId: 7 }, 'Evaluating target'),
  });
  repeat({
    name: 'disabled level, guarded by isLevelEnabled',
    log: () => {
      if (disabled.logger.isLevelEnabled('trace')) {
        disabled.logger.trace({ unitId: 3, targetId: 7 }, 'Evaluating target');
      }
    },
  });

  const plain = createBenchmarkLogger({ mixin: false });
  repeatRecording({
    name: 'enabled, message only, no time or mixin',
    logger: plain.logger,
    log: () => plain.logger.info('Simple message'),
  });

  const enabled = createBenchmarkLogger({ mixin: true });
  const workerSafety = enabled.logger.child({ component: 'WorkerSafety' });
  repeatRecording({
    name: 'enabled, message only',
    logger: enabled.logger,
    log: () => enabled.logger.info('Simple message'),
  });
  repeatRecording({
    name: 'enabled, child, mixin and 3 primitive fields',
    logger: enabled.logger,
    log: () =>
      workerSafety.info(
        { actorId: 12, reason: 'attacked', health: 0.35 },
        'Worker escaping'
      ),
  });
  repeatRecording({
    name: 'enabled, nested object and array fields',
    logger: enabled.logger,
    log: () =>
      workerSafety.info(
        { position: { x: -1250.5, y: 3072 }, path: [1, 2, 3] },
        'Moving'
      ),
  });

  let flushSeconds = 0;
  for (let round = 0; round < FlushRounds; round++) {
    fillWithTypicalRecords({ logger: workerSafety, count: BatchSize });
    flushSeconds += time({ run: () => enabled.logger.flush() });
  }
  report({
    result: {
      name: `flush ${BatchSize}-record batches, per record`,
      operations: BatchSize * FlushRounds,
      seconds: flushSeconds,
    },
  });

  const batch = enabled.lastBatch();
  const transport = createPreloadTransport({ natives: NoopPreloadNatives })({
    session: 'benchmark',
    directory: 'logs',
  });
  report({
    result: {
      name: `preload transport, ${batch.jsonl.length}-byte batch, no-op natives`,
      operations: FlushRounds,
      seconds: time({
        run: () => {
          for (let round = 0; round < FlushRounds; round++) {
            transport.write({ batch });
          }
        },
      }),
    },
  });
}

const CallCount = 204_800;
const BatchSize = 512;
const FlushRounds = 40;

interface RepeatRecordingArgs {
  name: string;
  log: () => void;
  logger: Logger;
}

interface BenchmarkLogger {
  logger: Logger;
  /** The batch the latest flush wrote. */
  lastBatch(): LogRecordBatch;
}

function createBenchmarkLogger({ mixin }: { mixin: boolean }): BenchmarkLogger {
  let gameTime = 0;
  let lastBatch: LogRecordBatch = { jsonl: '', recordCount: 0 };
  const keepLastBatch: LogTransport = {
    write({ batch }) {
      lastBatch = batch;
    },
  };
  const logger = createLogger({
    level: 'info',
    transport: keepLastBatch,
    bufferCapacity: BatchSize,
    batchSize: BatchSize,
    readTime: mixin ? () => '1793039520000' : undefined,
    mixin: mixin
      ? () => {
          gameTime += 0.1;
          return { gameTime };
        }
      : undefined,
  });

  return { logger, lastBatch: () => lastBatch };
}

interface FillWithTypicalRecordsArgs {
  logger: Logger;
  count: number;
}

function fillWithTypicalRecords({ logger, count }: FillWithTypicalRecordsArgs) {
  for (let index = 0; index < count; index++) {
    logger.info(
      { actorId: index, reason: 'attacked by "Grunt"', health: 0.35 },
      'Worker escaping'
    );
  }
}

const NoopPreloadNatives: PreloadNatives = {
  preloadGenClear() {},
  preloadGenStart() {},
  preload() {},
  preloadGenEnd() {},
};
