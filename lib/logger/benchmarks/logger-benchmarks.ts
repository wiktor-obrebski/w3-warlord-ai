import { createLogger, type Logger } from '../create-logger';
import {
  createPreloadTransport,
  type PreloadNatives,
} from '../preload-transport';
import {
  createLogRecordBuffer,
  type LogRecordBatch,
  type LogRecordBuffer,
} from '../record-buffer';

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
 * measures Warcraft: the export's in-game cost is reported by the
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

  // Drains between rounds, outside the measured time, so that every call
  // records instead of being dropped by a full buffer.
  const repeatRecording = ({ name, log, buffer }: RepeatRecordingArgs) => {
    let seconds = 0;

    for (let round = 0; round < CallCount / BatchSize; round++) {
      seconds += time({
        run: () => {
          for (let index = 0; index < BatchSize; index++) {
            log();
          }
        },
      });
      buffer.drain({ maxRecords: BatchSize });
    }

    report({ result: { name, operations: CallCount, seconds } });
  };

  const disabled = createBenchmarkLogger({ capacity: 2 });
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

  const plainBuffer = createLogRecordBuffer({ capacity: BatchSize });
  const plain = createLogger({ level: 'info', buffer: plainBuffer });
  repeatRecording({
    name: 'enabled, message only, no time or mixin',
    buffer: plainBuffer,
    log: () => plain.info('Simple message'),
  });

  const enabled = createBenchmarkLogger({ capacity: BatchSize });
  const workerSafety = enabled.logger.child({ component: 'WorkerSafety' });
  repeatRecording({
    name: 'enabled, message only',
    buffer: enabled.buffer,
    log: () => enabled.logger.info('Simple message'),
  });
  repeatRecording({
    name: 'enabled, child, mixin and 3 primitive fields',
    buffer: enabled.buffer,
    log: () =>
      workerSafety.info(
        { actorId: 12, reason: 'attacked', health: 0.35 },
        'Worker escaping'
      ),
  });
  repeatRecording({
    name: 'enabled, nested object and array fields',
    buffer: enabled.buffer,
    log: () =>
      workerSafety.info(
        { position: { x: -1250.5, y: 3072 }, path: [1, 2, 3] },
        'Moving'
      ),
  });

  let batch: LogRecordBatch = { jsonl: '', recordCount: 0 };
  let drainSeconds = 0;
  for (let round = 0; round < DrainRounds; round++) {
    fillWithTypicalRecords({ logger: workerSafety, count: BatchSize });
    drainSeconds += time({
      run: () => {
        batch = enabled.buffer.drain({ maxRecords: BatchSize });
      },
    });
  }
  report({
    result: {
      name: `drain and format ${BatchSize}-record batches, per record`,
      operations: BatchSize * DrainRounds,
      seconds: drainSeconds,
    },
  });

  const transport = createPreloadTransport({ natives: NoopPreloadNatives })({
    session: 'benchmark',
    directory: 'WarlordLogs',
  });
  report({
    result: {
      name: `preload transport, ${batch.jsonl.length}-byte batch, no-op natives`,
      operations: DrainRounds,
      seconds: time({
        run: () => {
          for (let round = 0; round < DrainRounds; round++) {
            transport.write({ batch });
          }
        },
      }),
    },
  });
}

const CallCount = 204_800;
const BatchSize = 512;
const DrainRounds = 40;

interface RepeatRecordingArgs {
  name: string;
  log: () => void;
  buffer: LogRecordBuffer;
}

interface BenchmarkLogger {
  logger: Logger;
  buffer: LogRecordBuffer;
}

function createBenchmarkLogger({
  capacity,
}: {
  capacity: number;
}): BenchmarkLogger {
  const buffer = createLogRecordBuffer({ capacity });
  let gameTime = 0;
  const logger = createLogger({
    level: 'info',
    buffer,
    readTime: () => 1793039520000,
    mixin: () => {
      gameTime += 0.1;
      return { gameTime };
    },
  });

  return { logger, buffer };
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
