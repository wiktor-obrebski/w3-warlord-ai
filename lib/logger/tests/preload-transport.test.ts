import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseBatchFile, parseBatchFileName } from '../batch-file';
import { createLogger } from '../create-logger';
import {
  createPreloadTransport,
  PRELOAD_CHUNK_LENGTH,
} from '../preload-transport';
import { createLogRecordBuffer } from '../record-buffer';
import { createFakePreloadEngine } from './support/fake-preload-engine';

describe('preload transport', () => {
  it('writes each batch to a new, numbered file', () => {
    const { logger, exportBatch, files } = setUp();

    logger.info('first');
    exportBatch();
    logger.info('second');
    exportBatch();

    assert.deepEqual(
      [...files.keys()],
      [
        'logs/1793039520000-p1-00000000.txt',
        'logs/1793039520000-p1-00000001.txt',
      ]
    );
    assert.deepEqual(
      parseBatchFileName({ fileName: '1793039520000-p1-00000001.txt' }),
      { session: '1793039520000-p1', batch: 1 }
    );
  });

  it('writes a header and the records, readable by parseBatchFile', () => {
    const { logger, exportBatch, files } = setUp();

    logger.info({ path: 'C:\\Maps', quote: '"q" )' }, 'Escapes');
    logger.warn('Second');
    exportBatch();

    const parsed = parseBatchFile({
      content: Buffer.from(files.values().next().value!, 'latin1'),
    });

    assert.equal(parsed.status, 'complete');
    assert.ok(parsed.status === 'complete');
    assert.equal(parsed.session, '1793039520000-p1');
    assert.equal(parsed.batch, 0);
    assert.deepEqual(
      parsed.lines.map((line) => JSON.parse(line) as unknown),
      [
        {
          level: 30,
          seq: 1,
          path: 'C:\\Maps',
          quote: '"q" )',
          msg: 'Escapes',
        },
        { level: 40, seq: 2, msg: 'Second' },
      ]
    );
  });

  it('splits content into Preload arguments the engine accepts', () => {
    const { logger, exportBatch, engine } = setUp();

    for (let index = 0; index < 50; index++) {
      logger.info({ index, padding: 'x'.repeat(index * 7) }, 'Long record');
    }
    exportBatch();

    assert.ok(engine.preloadArguments.length > 1);
    for (const preloadArgument of engine.preloadArguments) {
      assert.ok(preloadArgument.length <= PRELOAD_CHUNK_LENGTH);
      assert.equal(preloadArgument.includes('\0'), false);
    }
  });

  it('starts every file from an empty preload buffer', () => {
    const { logger, exportBatch, files } = setUp();

    logger.info('first');
    exportBatch();
    logger.info('second');
    exportBatch();

    const second = [...files.values()][1]!;
    assert.equal(second.includes('first'), false);
  });
});

function setUp() {
  const files = new Map<string, string>();
  const engine = createFakePreloadEngine({
    writeFile: ({ fileName, content }) => {
      assert.equal(files.has(fileName), false, `${fileName} was rewritten`);
      files.set(fileName, content);
    },
  });
  const transport = createPreloadTransport({ natives: engine.natives })({
    session: '1793039520000-p1',
    directory: 'logs',
  });
  const buffer = createLogRecordBuffer({ capacity: 1000 });
  const logger = createLogger({ buffer });

  const exportBatch = () =>
    transport.write({ batch: buffer.drain({ maxRecords: 1000 }) });

  return { logger, exportBatch, files, engine };
}
