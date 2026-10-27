import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseBatchFile, parseBatchFileName } from '../batch-file';
import {
  PRELOAD_BATCH_FORMAT,
  PRELOAD_CHUNK_LENGTH,
} from '../preload-transport';
import { renderPreloadFile } from './support/fake-preload-engine';

describe('parseBatchFile', () => {
  it('reads the session, batch number and record lines', () => {
    const parsed = parseBatchFile({
      content: renderBatch({
        records: [record({ seq: 1 }), record({ seq: 2 })],
      }),
    });

    assert.deepEqual(parsed, {
      status: 'complete',
      session: Session,
      batch: 7,
      lines: [record({ seq: 1 }), record({ seq: 2 })],
      invalidLines: [],
    });
  });

  it('joins UTF-8 and escapes spread over several Preload arguments', () => {
    const line = JSON.stringify({
      msg: `${'ą'.repeat(PRELOAD_CHUNK_LENGTH)} "C:\\Maps" 🎮 ${'x'.repeat(300)}`,
    });

    const parsed = parseBatchFile({
      content: renderBatch({ records: [line] }),
    });

    assert.ok(parsed.status === 'complete');
    assert.deepEqual(parsed.lines, [line]);
  });

  it('is not misled by records containing the file trailer', () => {
    const line = JSON.stringify({
      msg: '\tcall PreloadEnd( 0.0 )\n\nendfunction',
    });

    const parsed = parseBatchFile({
      content: renderBatch({ records: [line] }),
    });

    assert.ok(parsed.status === 'complete');
    assert.deepEqual(parsed.lines, [line]);
  });

  it('accepts files with Windows line ends', () => {
    const parsed = parseBatchFile({
      content: renderBatch({ records: [record({ seq: 1 })], lineEnd: '\r\n' }),
    });

    assert.ok(parsed.status === 'complete');
    assert.deepEqual(parsed.lines, [record({ seq: 1 })]);
  });

  it('reports a file without its trailer as incomplete', () => {
    const complete = renderBatch({ records: [record({ seq: 1 })] });

    assert.equal(
      parseBatchFile({ content: complete.slice(0, -40) }).status,
      'incomplete'
    );
  });

  it('reports content not matching its header as malformed', () => {
    const cases = [
      renderBatch({
        records: [record({ seq: 1 })],
        corrupt: (content) => content.replace('record 1', 'rec'),
      }),
      renderBatch({
        records: [record({ seq: 1 })],
        corrupt: (content) => content.replace('"records":1', '"records":2'),
      }),
      renderBatch({
        records: [record({ seq: 1 })],
        corrupt: (content) => content.replace(PRELOAD_BATCH_FORMAT, 'other'),
      }),
      renderPreloadFile({ preloadArguments: [] }),
    ];

    for (const content of cases) {
      assert.equal(parseBatchFile({ content }).status, 'malformed');
    }
  });

  it('separates record lines that are not JSON objects', () => {
    const parsed = parseBatchFile({
      content: renderBatch({
        records: [
          record({ seq: 1 }),
          '{"level":30,',
          '[1]',
          record({ seq: 3 }),
        ],
      }),
    });

    assert.ok(parsed.status === 'complete');
    assert.deepEqual(parsed.lines, [record({ seq: 1 }), record({ seq: 3 })]);
    assert.deepEqual(parsed.invalidLines, [
      { lineNumber: 2, line: '{"level":30,' },
      { lineNumber: 3, line: '[1]' },
    ]);
  });
});

describe('parseBatchFileName', () => {
  it('reads the session and batch number of batch files only', () => {
    assert.deepEqual(
      parseBatchFileName({ fileName: '1793039520000-p1-00000012.txt' }),
      { session: '1793039520000-p1', batch: 12 }
    );

    for (const fileName of [
      'notes.txt',
      '-00000001.txt',
      `${Session}-0001.txt`,
      `${Session}-0000000x.txt`,
      `${Session}-00000001.txt.rejected`,
    ]) {
      assert.equal(parseBatchFileName({ fileName }), undefined, fileName);
    }
  });
});

const Session = '1793039520000-p1';

function record({ seq }: { seq: number }): string {
  return JSON.stringify({ level: 30, seq, msg: `record ${seq}` });
}

interface RenderBatchArgs {
  records: string[];
  lineEnd?: string;
  corrupt?: (content: string) => string;
}

/**
 * The text of a batch file as the game writes it, cut into Preload
 * arguments between characters.
 */
function renderBatch({
  records,
  lineEnd,
  corrupt = (content) => content,
}: RenderBatchArgs): string {
  const jsonl = records.map((line) => `${line}\n`).join('');
  const header = JSON.stringify({
    format: PRELOAD_BATCH_FORMAT,
    version: 1,
    session: Session,
    batch: 7,
    records: records.length,
    bytes: Buffer.byteLength(jsonl),
  });
  const characters = Array.from(corrupt(`${header}\n${jsonl}`));
  const preloadArguments: string[] = [];

  for (
    let offset = 0;
    offset < characters.length;
    offset += PRELOAD_CHUNK_LENGTH
  ) {
    preloadArguments.push(
      characters.slice(offset, offset + PRELOAD_CHUNK_LENGTH).join('')
    );
  }

  return renderPreloadFile({ preloadArguments, lineEnd });
}
