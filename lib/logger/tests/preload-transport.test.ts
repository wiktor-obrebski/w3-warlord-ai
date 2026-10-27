import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createLogger } from '../core/create-logger.ts';
import { parseBatchFile, parseBatchFileName } from '../preload/batch-file.ts';
import {
  createPreloadTransport,
  PRELOAD_CHUNK_LENGTH,
} from '../preload/preload-transport.ts';
import { createFakePreloadEngine } from './support/fake-preload-engine.ts';

describe('preload transport', () => {
  it('writes each batch to a new, numbered file', () => {
    const { logger, files } = setUp();

    logger.info('first');
    logger.flush();
    logger.info('second');
    logger.flush();

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
    const { logger, files } = setUp();

    logger.info({ path: 'C:\\Maps', quote: '"q" )' }, 'Escapes');
    logger.warn('Second');
    logger.flush();

    const parsed = parseBatchFile({ content: files.values().next().value! });

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
    const { logger, engine } = setUp();

    for (let index = 0; index < 50; index++) {
      logger.info({ index, padding: 'x'.repeat(index * 7) }, 'Long record');
    }
    logger.flush();

    assert.ok(engine.preloadArguments.length > 1);
    for (const preloadArgument of engine.preloadArguments) {
      assert.ok(preloadArgument.length <= PRELOAD_CHUNK_LENGTH);
      assert.equal(preloadArgument.includes('\0'), false);
    }
  });

  it('never cuts an argument inside a UTF-8 character', () => {
    // Each character stands for one byte, as in Lua strings.
    const utf8Bytes = Buffer.from(
      `${'ą'.repeat(300)}🎮${'x'.repeat(254)}${'日本'.repeat(100)}\n`,
      'utf8'
    ).toString('latin1');
    const { engine, transport } = setUp();

    transport.write({ batch: { jsonl: utf8Bytes, recordCount: 1 } });

    assert.ok(engine.preloadArguments.length > 3);
    for (const preloadArgument of engine.preloadArguments) {
      assert.ok(preloadArgument.length <= PRELOAD_CHUNK_LENGTH);
      assert.equal(
        Buffer.from(preloadArgument, 'latin1').toString('utf8').includes('�'),
        false
      );
    }
    assert.equal(engine.preloadArguments.join('').endsWith(utf8Bytes), true);
  });

  it('starts every file from an empty preload buffer', () => {
    const { logger, files } = setUp();

    logger.info('first');
    logger.flush();
    logger.info('second');
    logger.flush();

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
  const logger = createLogger({
    transport,
    bufferCapacity: 1000,
    batchSize: 1000,
  });

  return { logger, files, engine, transport };
}
