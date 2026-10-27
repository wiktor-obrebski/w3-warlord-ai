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

  it('reassembles UTF-8 and escapes split across Preload arguments', () => {
    const line = JSON.stringify({
      msg: `${'ą'.repeat(PRELOAD_CHUNK_LENGTH)} "C:\\Maps" 🎮`,
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
      parseBatchFile({ content: complete.subarray(0, complete.length - 40) })
        .status,
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
      Buffer.from(renderPreloadFile({ preloadArguments: [] }), 'latin1'),
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
    assert.equal(parseBatchFileName({ fileName: 'notes.txt' }), undefined);
    assert.equal(
      parseBatchFileName({ fileName: `${Session}-00000001.txt.rejected` }),
      undefined
    );
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
 * The batch file the game writes, cut into Preload arguments by bytes as
 * Lua strings are.
 */
function renderBatch({
  records,
  lineEnd,
  corrupt = (content) => content,
}: RenderBatchArgs): Buffer {
  const jsonl = Buffer.from(
    records.map((line) => `${line}\n`).join(''),
    'utf8'
  ).toString('latin1');
  const header = JSON.stringify({
    format: PRELOAD_BATCH_FORMAT,
    version: 1,
    session: Session,
    batch: 7,
    records: records.length,
    bytes: jsonl.length,
  });
  const content = corrupt(`${header}\n${jsonl}`);
  const preloadArguments: string[] = [];

  for (
    let offset = 0;
    offset < content.length;
    offset += PRELOAD_CHUNK_LENGTH
  ) {
    preloadArguments.push(content.slice(offset, offset + PRELOAD_CHUNK_LENGTH));
  }

  return Buffer.from(
    renderPreloadFile({ preloadArguments, lineEnd }),
    'latin1'
  );
}
