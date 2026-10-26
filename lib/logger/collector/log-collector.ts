import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseBatchFile, parseBatchFileName } from './batch-file';

export { createLogCollector, COLLECTOR_STATE_FILE_NAME, type LogCollector };

/** Remembers, per session, the next batch to collect, across restarts. */
const COLLECTOR_STATE_FILE_NAME = '.warlord-collector-state.json';

interface LogCollector {
  /** Collects every batch that is ready, in order. */
  poll(): Promise<void>;
}

interface CreateLogCollectorArgs {
  /** The folder the game writes batch files to. */
  directory: string;
  /** Writes record lines; resolves once the text was handed off. */
  writeRecords: (text: string) => Promise<void>;
  /** Reports collector diagnostics. */
  report: (message: string) => void;
  /** Current time in milliseconds, comparable to file modification times. */
  now: () => number;
  /** Delete batch files once collected; otherwise they are left in place. */
  deleteCollected: boolean;
  /** How long to wait for a missing batch before skipping it. */
  gapTimeoutMs: number;
  /** How long an incomplete batch file may stay unchanged before it is rejected. */
  incompleteTimeoutMs: number;
}

/**
 * Collects the batch files of every session in the folder in batch order,
 * writing each record with its `session` added. A batch is collected once:
 * after its records are written, the collector saves its progress, then
 * deletes the file. A restart between writing and saving writes that batch
 * again; nothing else is written twice.
 *
 * A session's first collected batch is the lowest one present. A missing
 * batch is skipped once a later one has waited for `gapTimeoutMs`; a batch
 * file that stays incomplete for `incompleteTimeoutMs`, or is malformed, is
 * renamed to `*.rejected` and skipped.
 */
function createLogCollector({
  directory,
  writeRecords,
  report,
  now,
  deleteCollected,
  gapTimeoutMs,
  incompleteTimeoutMs,
}: CreateLogCollectorArgs): LogCollector {
  const statePath = path.join(directory, COLLECTOR_STATE_FILE_NAME);
  const gapsSince = new Map<string, number>();
  let state: CollectorState | undefined;

  const saveState = async () => {
    const temporaryPath = `${statePath}.tmp`;

    await fs.writeFile(temporaryPath, JSON.stringify(state));
    await fs.rename(temporaryPath, statePath);
  };

  const reject = async ({ fileName, reason }: RejectArgs) => {
    report(`Rejected ${fileName}: ${reason}.`);
    await fs.rename(
      path.join(directory, fileName),
      path.join(directory, `${fileName}.rejected`)
    );
  };

  const collectBatch = async ({
    session,
    fileName,
  }: CollectBatchArgs): Promise<BatchOutcome> => {
    const filePath = path.join(directory, fileName);
    const [content, stats] = await Promise.all([
      fs.readFile(filePath),
      fs.stat(filePath),
    ]);
    const parsed = parseBatchFile({ content });

    if (parsed.status === 'incomplete') {
      if (now() - stats.mtimeMs < incompleteTimeoutMs) {
        return 'pending';
      }
      await reject({ fileName, reason: parsed.reason });
      return 'done';
    }

    if (parsed.status === 'malformed') {
      await reject({ fileName, reason: parsed.reason });
      return 'done';
    }

    const expected = parseBatchFileName({ fileName })!;

    if (parsed.session !== session || parsed.batch !== expected.batch) {
      await reject({
        fileName,
        reason: `its header names session ${parsed.session}, batch ${parsed.batch}`,
      });
      return 'done';
    }

    for (const { lineNumber, line } of parsed.invalidLines) {
      report(`Skipped invalid record ${lineNumber} of ${fileName}: ${line}`);
    }

    if (parsed.lines.length > 0) {
      await writeRecords(
        parsed.lines.map((line) => withSession({ line, session })).join('\n') +
          '\n'
      );
    }

    return 'collected';
  };

  const collectSession = async ({ session, files }: CollectSessionArgs) => {
    const progress = (state!.sessions[session] ??= { nextBatch: null });

    while (files.size > 0) {
      const lowestBatch = Math.min(...files.keys());

      if (progress.nextBatch !== null && lowestBatch < progress.nextBatch) {
        // Collected before the collector could delete it, or kept.
        if (deleteCollected) {
          await fs.rm(path.join(directory, files.get(lowestBatch)!));
        }
        files.delete(lowestBatch);
        continue;
      }

      if (progress.nextBatch === null) {
        if (lowestBatch > 0) {
          report(`Session ${session}: collecting from batch ${lowestBatch}.`);
        }
        progress.nextBatch = lowestBatch;
      }

      const fileName = files.get(progress.nextBatch);

      if (fileName === undefined) {
        const gapSince = gapsSince.get(session) ?? now();

        gapsSince.set(session, gapSince);
        if (now() - gapSince < gapTimeoutMs) {
          return;
        }

        report(
          `Session ${session}: batches ${progress.nextBatch} to ${lowestBatch - 1} are missing.`
        );
        progress.nextBatch = lowestBatch;
        gapsSince.delete(session);
        await saveState();
        continue;
      }

      gapsSince.delete(session);

      const outcome = await collectBatch({ session, fileName });

      if (outcome === 'pending') {
        return;
      }

      progress.nextBatch += 1;
      await saveState();
      if (outcome === 'collected' && deleteCollected) {
        await fs.rm(path.join(directory, fileName));
      }
      files.delete(progress.nextBatch - 1);
    }
  };

  return {
    async poll() {
      state ??= await loadState({ statePath });

      const sessions = await listBatchFiles({ directory });

      for (const [session, files] of sessions) {
        await collectSession({ session, files });
      }
    },
  };
}

interface CollectorState {
  version: 1;
  sessions: Record<string, { nextBatch: number | null }>;
}

type BatchOutcome = 'collected' | 'done' | 'pending';

interface RejectArgs {
  fileName: string;
  reason: string;
}

interface CollectBatchArgs {
  session: string;
  fileName: string;
}

interface CollectSessionArgs {
  session: string;
  /** File names by batch number. */
  files: Map<number, string>;
}

async function loadState({
  statePath,
}: {
  statePath: string;
}): Promise<CollectorState> {
  let text: string;

  try {
    text = await fs.readFile(statePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, sessions: {} };
    }
    throw error;
  }

  const loaded = JSON.parse(text) as Partial<CollectorState>;

  if (loaded.version !== 1 || typeof loaded.sessions !== 'object') {
    throw new Error(`Unrecognized collector state in ${statePath}.`);
  }

  return loaded as CollectorState;
}

/** Batch files by session, then by batch number. */
async function listBatchFiles({
  directory,
}: {
  directory: string;
}): Promise<Map<string, Map<number, string>>> {
  const sessions = new Map<string, Map<number, string>>();
  let fileNames: string[];

  try {
    fileNames = await fs.readdir(directory);
  } catch (error) {
    // The game creates the folder with its first batch.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return sessions;
    }
    throw error;
  }

  for (const fileName of fileNames.sort()) {
    const name = parseBatchFileName({ fileName });

    if (name === undefined) {
      continue;
    }

    let files = sessions.get(name.session);
    if (files === undefined) {
      files = new Map();
      sessions.set(name.session, files);
    }
    files.set(name.batch, fileName);
  }

  return sessions;
}

// Inserted as text: parsing and re-serializing would change how the game
// formatted the record.
function withSession({ line, session }: { line: string; session: string }) {
  const sessionMember = `"session":${JSON.stringify(session)}`;
  const members = line.trim().slice(1).trimStart();

  return members === '}'
    ? `{${sessionMember}}`
    : `{${sessionMember},${members}`;
}
