import { strict as assert } from 'node:assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  COLLECTOR_STATE_FILE_NAME,
  createLogCollector,
} from '../collector/log-collector';
import {
  PRELOAD_BATCH_FORMAT,
  PRELOAD_CHUNK_LENGTH,
} from '../preload-transport';
import { renderPreloadFile } from './support/fake-preload-engine';

describe('log collector', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'warlord-logs-'));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('writes the records of each batch in order, with their session', async () => {
    await writeBatch({ directory, batch: 1, records: [record({ seq: 3 })] });
    await writeBatch({
      directory,
      batch: 0,
      records: [record({ seq: 1 }), record({ seq: 2 })],
    });
    const { collector, output } = setUp({ directory });

    await collector.poll();

    assert.deepEqual(output.records(), [
      { session: Session, level: 30, seq: 1, msg: 'record 1' },
      { session: Session, level: 30, seq: 2, msg: 'record 2' },
      { session: Session, level: 30, seq: 3, msg: 'record 3' },
    ]);
    assert.deepEqual(await listBatchFiles({ directory }), []);
  });

  it('writes each record as one line of the original JSON', async () => {
    await writeBatch({
      directory,
      batch: 0,
      records: [
        '{"level":30,"time":1793039520000,"seq":1,"gameTime":38.75,"msg":"x"}',
      ],
    });
    const { collector, output } = setUp({ directory });

    await collector.poll();

    assert.equal(
      output.text(),
      `{"session":"${Session}","level":30,"time":1793039520000,"seq":1,"gameTime":38.75,"msg":"x"}\n`
    );
  });

  it('reassembles UTF-8 and escapes split across Preload arguments', async () => {
    const message = `${'ą'.repeat(PRELOAD_CHUNK_LENGTH)} "C:\\Maps" 🎮`;
    await writeBatch({
      directory,
      batch: 0,
      records: [JSON.stringify({ level: 30, seq: 1, msg: message })],
    });
    const { collector, output } = setUp({ directory });

    await collector.poll();

    assert.equal(output.records()[0]?.msg, message);
  });

  it('accepts files with Windows line ends', async () => {
    await writeBatch({
      directory,
      batch: 0,
      records: [record({ seq: 1 }), record({ seq: 2 })],
      lineEnd: '\r\n',
    });
    const { collector, output } = setUp({ directory });

    await collector.poll();

    assert.equal(output.records().length, 2);
  });

  it('waits for a missing batch, then skips it after the gap timeout', async () => {
    await writeBatch({ directory, batch: 0, records: [record({ seq: 1 })] });
    await writeBatch({ directory, batch: 2, records: [record({ seq: 3 })] });
    const { collector, output, reports, clock } = setUp({ directory });

    await collector.poll();
    assert.deepEqual(
      output.records().map(({ seq }) => seq),
      [1]
    );

    clock.advance(GapTimeoutMs - 1);
    await collector.poll();
    assert.equal(output.records().length, 1);

    clock.advance(1);
    await collector.poll();
    assert.deepEqual(
      output.records().map(({ seq }) => seq),
      [1, 3]
    );
    assert.match(reports.join('\n'), /batches 1 to 1 are missing/);
  });

  it('collects a late batch arriving within the gap timeout in order', async () => {
    await writeBatch({ directory, batch: 1, records: [record({ seq: 2 })] });
    const { collector, output } = setUp({ directory });
    await collector.poll();
    const writtenBefore = output.records().length;

    // A fresh session starts from its lowest batch present.
    assert.equal(writtenBefore, 1);

    await writeBatch({ directory, batch: 3, records: [record({ seq: 4 })] });
    await collector.poll();
    await writeBatch({ directory, batch: 2, records: [record({ seq: 3 })] });
    await collector.poll();

    assert.deepEqual(
      output.records().map(({ seq }) => seq),
      [2, 3, 4]
    );
  });

  it('does not write a batch again, after a restart or when its file reappears', async () => {
    await writeBatch({ directory, batch: 0, records: [record({ seq: 1 })] });
    const first = setUp({ directory });
    await first.collector.poll();

    // As if the collector stopped after saving its state but before
    // deleting the file.
    await writeBatch({ directory, batch: 0, records: [record({ seq: 1 })] });
    await writeBatch({ directory, batch: 1, records: [record({ seq: 2 })] });
    const restarted = setUp({ directory });
    await restarted.collector.poll();

    assert.deepEqual(
      [...first.output.records(), ...restarted.output.records()].map(
        ({ seq }) => seq
      ),
      [1, 2]
    );
    assert.deepEqual(await listBatchFiles({ directory }), []);

    await writeBatch({ directory, batch: 1, records: [record({ seq: 2 })] });
    await restarted.collector.poll();
    assert.equal(restarted.output.records().length, 1);
  });

  it('waits for a file being written, and rejects one never finished', async () => {
    const complete = renderBatch({ batch: 0, records: [record({ seq: 1 })] });
    const filePath = batchPath({ directory, batch: 0 });
    const { collector, output, reports, clock } = setUp({ directory });

    await fs.writeFile(filePath, complete.subarray(0, complete.length - 40));
    await collector.poll();
    assert.equal(output.records().length, 0);

    await fs.writeFile(filePath, complete);
    await collector.poll();
    assert.equal(output.records().length, 1);

    await fs.writeFile(
      batchPath({ directory, batch: 1 }),
      renderBatch({ batch: 1, records: [record({ seq: 2 })] }).subarray(0, 100)
    );
    await writeBatch({ directory, batch: 2, records: [record({ seq: 3 })] });
    clock.advance(IncompleteTimeoutMs);
    await collector.poll();

    assert.deepEqual(
      output.records().map(({ seq }) => seq),
      [1, 3]
    );
    assert.match(reports.join('\n'), /Rejected .*-00000001\.txt/);
    assert.ok(
      (await fs.readdir(directory)).includes(`${Session}-00000001.txt.rejected`)
    );
  });

  it('rejects a batch whose content does not match its header', async () => {
    const truncated = renderBatch({
      batch: 0,
      records: [record({ seq: 1 })],
      corrupt: (content) => content.replace('record 1', 'rec'),
    });
    await fs.writeFile(batchPath({ directory, batch: 0 }), truncated);
    await writeBatch({ directory, batch: 1, records: [record({ seq: 2 })] });
    const { collector, output, reports } = setUp({ directory });

    await collector.poll();

    assert.deepEqual(
      output.records().map(({ seq }) => seq),
      [2]
    );
    assert.match(reports.join('\n'), /bytes of records/);
  });

  it('skips and reports records that are not JSON objects', async () => {
    await writeBatch({
      directory,
      batch: 0,
      records: [record({ seq: 1 }), '{"level":30,"seq":2,', record({ seq: 3 })],
    });
    const { collector, output, reports } = setUp({ directory });

    await collector.poll();

    assert.deepEqual(
      output.records().map(({ seq }) => seq),
      [1, 3]
    );
    assert.match(reports.join('\n'), /Skipped invalid record 2/);
  });

  it('collects sessions independently', async () => {
    await writeBatch({ directory, batch: 0, records: [record({ seq: 1 })] });
    await writeBatch({
      directory,
      session: 'other-p2',
      batch: 5,
      records: [record({ seq: 9 })],
    });
    const { collector, output } = setUp({ directory });

    await collector.poll();

    assert.deepEqual(
      output
        .records()
        .map(({ session, seq }) => `${String(session)}:${String(seq)}`)
        .sort(),
      [`${Session}:1`, 'other-p2:9']
    );
  });

  it('keeps collected files when asked, without writing them again', async () => {
    await writeBatch({ directory, batch: 0, records: [record({ seq: 1 })] });
    const { collector, output } = setUp({ directory, deleteCollected: false });

    await collector.poll();
    await collector.poll();

    assert.equal(output.records().length, 1);
    assert.equal((await listBatchFiles({ directory })).length, 1);
  });

  it('deletes a batch only after its records were handed off', async () => {
    await writeBatch({ directory, batch: 0, records: [record({ seq: 1 })] });
    let release = () => {};
    const handedOff = new Promise<void>((resolve) => {
      release = resolve;
    });
    const collector = createLogCollector({
      directory,
      writeRecords: () => handedOff,
      report: () => {},
      now: () => Date.now(),
      deleteCollected: true,
      gapTimeoutMs: GapTimeoutMs,
      incompleteTimeoutMs: IncompleteTimeoutMs,
    });

    const polling = collector.poll();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal((await listBatchFiles({ directory })).length, 1);

    release();
    await polling;
    assert.equal((await listBatchFiles({ directory })).length, 0);
    assert.ok(
      (await fs.readdir(directory)).includes(COLLECTOR_STATE_FILE_NAME)
    );
  });
});

const Session = '1793039520000-p1';
const GapTimeoutMs = 10_000;
const IncompleteTimeoutMs = 10_000;

interface SetUpArgs {
  directory: string;
  deleteCollected?: boolean;
}

function setUp({ directory, deleteCollected = true }: SetUpArgs) {
  const written: string[] = [];
  const reports: string[] = [];
  // Ahead of the files' modification times, which are the real time.
  let now = Date.now() + 1000;
  const collector = createLogCollector({
    directory,
    writeRecords: (text) => {
      written.push(text);
      return Promise.resolve();
    },
    report: (message) => reports.push(message),
    now: () => now,
    deleteCollected,
    gapTimeoutMs: GapTimeoutMs,
    incompleteTimeoutMs: IncompleteTimeoutMs,
  });

  const output = {
    text: () => written.join(''),
    records: () =>
      written
        .join('')
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
  const clock = {
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };

  return { collector, output, reports, clock };
}

function record({ seq }: { seq: number }): string {
  return JSON.stringify({ level: 30, seq, msg: `record ${seq}` });
}

interface RenderBatchArgs {
  session?: string;
  batch: number;
  records: string[];
  lineEnd?: string;
  corrupt?: (content: string) => string;
}

/**
 * The batch file the game writes, cut into Preload arguments by bytes as
 * Lua strings are.
 */
function renderBatch({
  session = Session,
  batch,
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
    session,
    batch,
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

interface WriteBatchArgs extends RenderBatchArgs {
  directory: string;
}

async function writeBatch({ directory, ...batchArgs }: WriteBatchArgs) {
  await fs.writeFile(
    batchPath({
      directory,
      session: batchArgs.session,
      batch: batchArgs.batch,
    }),
    renderBatch(batchArgs)
  );
}

interface BatchPathArgs {
  directory: string;
  session?: string;
  batch: number;
}

function batchPath({ directory, session = Session, batch }: BatchPathArgs) {
  return path.join(
    directory,
    `${session}-${String(batch).padStart(8, '0')}.txt`
  );
}

async function listBatchFiles({ directory }: { directory: string }) {
  return (await fs.readdir(directory)).filter((fileName) =>
    fileName.endsWith('.txt')
  );
}
