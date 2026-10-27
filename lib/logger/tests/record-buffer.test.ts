import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createLogRecordBuffer } from '../core/record-buffer.ts';

describe('log record buffer', () => {
  it('drains records in order, in batches, numbering them continuously', () => {
    const { logger, drain } = setUp({ capacity: 10 });

    for (let index = 1; index <= 5; index++) {
      logger.info({ index }, 'record');
    }

    const first = drain({ maxRecords: 2 });
    logger.info({ index: 6 }, 'record');
    const second = drain({ maxRecords: 10 });

    assert.deepEqual(
      first.map(({ seq, index }) => [seq, index]),
      [
        [1, 1],
        [2, 2],
      ]
    );
    assert.deepEqual(
      second.map(({ seq, index }) => [seq, index]),
      [
        [3, 3],
        [4, 4],
        [5, 5],
        [6, 6],
      ]
    );
    assert.deepEqual(drain({ maxRecords: 10 }), []);
  });

  it('reports the drained record count and formats one line per record', () => {
    const { buffer, logger } = setUp({ capacity: 4 });

    logger.info('a');
    logger.info('b');

    const batch = buffer.drain({ maxRecords: 10 });
    assert.equal(batch.recordCount, 2);
    assert.equal(
      batch.jsonl,
      '{"level":30,"seq":1,"msg":"a"}\n{"level":30,"seq":2,"msg":"b"}\n'
    );
    assert.deepEqual(buffer.drain({ maxRecords: 10 }), {
      jsonl: '',
      recordCount: 0,
    });
  });

  it('keeps working as the ring wraps around many times', () => {
    const { logger, drain } = setUp({ capacity: 3 });
    const seen: number[] = [];

    for (let round = 0; round < 20; round++) {
      logger.info({ round }, 'a');
      logger.info({ round }, 'b');
      seen.push(...drain({ maxRecords: 3 }).map(({ seq }) => seq as number));
    }

    assert.deepEqual(
      seen,
      Array.from({ length: 40 }, (_, index) => index + 1)
    );
  });

  it('drops new records when full and reports them once there is room', () => {
    const { logger, drain } = setUp({ capacity: 4 });

    for (let index = 1; index <= 7; index++) {
      logger.info({ index }, 'record');
    }

    assert.deepEqual(
      drain({ maxRecords: 1 }).map(({ index }) => index),
      [1]
    );

    // One free slot is not enough for the report and a record.
    logger.info({ index: 8 }, 'record');
    assert.deepEqual(
      drain({ maxRecords: 2 }).map(({ index }) => index),
      [2, 3]
    );

    logger.info({ index: 9 }, 'record');
    logger.info({ index: 10 }, 'record');

    assert.deepEqual(drain({ maxRecords: 10 }), [
      { level: 30, seq: 4, index: 4, msg: 'record' },
      {
        level: 40,
        seq: 9,
        dropped: 4,
        firstDroppedSeq: 5,
        lastDroppedSeq: 8,
        msg: 'Log records dropped: buffer full',
      },
      { level: 30, seq: 10, index: 9, msg: 'record' },
      { level: 30, seq: 11, index: 10, msg: 'record' },
    ]);
  });

  it('never holds more records than its capacity', () => {
    const { logger, drain } = setUp({ capacity: 5 });

    for (let index = 0; index < 1000; index++) {
      logger.info({ index }, 'flood');
    }

    const drained = drain({ maxRecords: 10_000 });
    assert.equal(drained.length, 5);
  });

  it('rejects a capacity too small for the drop report', () => {
    assert.throws(() => createLogRecordBuffer({ capacity: 1 }));
    assert.throws(() => createLogRecordBuffer({ capacity: NaN }));
  });
});

function setUp({ capacity }: { capacity: number }) {
  const buffer = createLogRecordBuffer({ capacity });

  // Stores `info` records as a logger would, without time or bindings.
  const logger = {
    info: (first: Record<string, number> | string, message?: string) => {
      if (typeof first === 'string') {
        buffer.append(30, undefined, '', undefined, first);
      } else {
        buffer.append(30, undefined, '', Object.entries(first).flat(), message);
      }
    },
  };

  const drain = ({ maxRecords }: { maxRecords: number }) =>
    buffer
      .drain({ maxRecords })
      .jsonl.split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);

  return { buffer, logger, drain };
}
