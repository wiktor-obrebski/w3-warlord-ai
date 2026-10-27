import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseBatchFile } from '../batch-file';
import { createDisabledLogger, createPreloadLogger } from '../preload-logger';
import { createFakePreloadEngine } from './support/fake-preload-engine';

describe('preload logger', () => {
  it('exports buffered records to a new batch file per export', () => {
    const { logger, exportBatch, readBatches } = setUp({});

    logger.info({ actorId: 12 }, 'first');
    exportBatch();
    logger.warn('second');
    exportBatch();

    assert.deepEqual(
      readBatches().map((records) => records.map(({ msg }) => msg as string)),
      [['first'], ['second']]
    );
  });

  it('writes nothing while no records are buffered', () => {
    const { exportBatch, readBatches } = setUp({});

    exportBatch();
    exportBatch();

    assert.deepEqual(readBatches(), []);
  });

  it('exports at most a batch of records at a time, in order', () => {
    const { logger, exportBatch, readBatches } = setUp({ batchSize: 2 });

    for (let index = 1; index <= 5; index++) {
      logger.info({ index }, 'record');
    }
    exportBatch();
    exportBatch();
    exportBatch();

    assert.deepEqual(
      readBatches().map((records) => records.map(({ index }) => index)),
      [[1, 2], [3, 4], [5]]
    );
  });

  it('reports each export in a debug record of the next batch', () => {
    let clockSeconds = 10;
    const { logger, exportBatch, readBatches } = setUp({
      level: 'debug',
      readClockSeconds: () => {
        clockSeconds += 0.0015;
        return clockSeconds;
      },
    });

    logger.info('first');
    logger.info('second');
    exportBatch();
    exportBatch();
    exportBatch();

    const batches = readBatches();
    assert.equal(batches.length, 2);
    assert.deepEqual(batches[1], [
      {
        level: 20,
        seq: 3,
        records: 2,
        bytes: batches[1]![0]!.bytes,
        formatMs: 1.5,
        writeMs: 1.5,
        msg: 'Log batch exported',
      },
    ]);
  });

  it('records nothing with a disabled logger', () => {
    const logger = createDisabledLogger();

    logger.fatal('ignored');
    assert.equal(
      logger.child({ component: 'X' }).isLevelEnabled('fatal'),
      false
    );
  });
});

interface SetUpArgs {
  level?: 'debug' | 'info';
  batchSize?: number;
  readClockSeconds?: () => number;
}

function setUp({ level, batchSize = 100, readClockSeconds }: SetUpArgs) {
  const files: string[] = [];
  const engine = createFakePreloadEngine({
    writeFile: ({ content }) => files.push(content),
  });
  const preloadLogger = createPreloadLogger({
    natives: engine.natives,
    level,
    readClockSeconds,
    session: 'session-p1',
    directory: 'logs',
    bufferCapacity: 100,
    batchSize,
  });

  const readBatches = () =>
    files.map((content) => {
      const parsed = parseBatchFile({ content });

      assert.ok(parsed.status === 'complete', JSON.stringify(parsed));
      return parsed.lines.map(
        (line) => JSON.parse(line) as Record<string, unknown>
      );
    });

  return {
    logger: preloadLogger.logger,
    exportBatch: () => preloadLogger.exportBatch(),
    readBatches,
  };
}
