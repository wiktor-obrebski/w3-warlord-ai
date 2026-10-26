import { parseArgs } from 'node:util';
import { createLogCollector } from './log-collector';

const Usage = `Usage: npm run collect-logs -- --dir <folder> [options]

Writes the records of the game's log batch files to stdout as JSON lines,
and diagnostics to stderr.

  --dir <folder>                 the batch files' folder, e.g.
                                 <Documents>/Warcraft III/CustomMapData/WarlordLogs
  --poll-ms <ms>                 how often to look for new batches (default 250)
  --gap-timeout-ms <ms>          wait for a missing batch (default 10000)
  --incomplete-timeout-ms <ms>   wait for a batch file being written (default 10000)
  --keep                         leave collected batch files in place
`;

const DefaultPollMs = 250;
const DefaultGapTimeoutMs = 10_000;
const DefaultIncompleteTimeoutMs = 10_000;

void main();

async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string' },
      'poll-ms': { type: 'string' },
      'gap-timeout-ms': { type: 'string' },
      'incomplete-timeout-ms': { type: 'string' },
      keep: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help || values.dir === undefined) {
    process.stderr.write(Usage);
    process.exitCode = values.help ? 0 : 1;
    return;
  }

  const pollMs = readMilliseconds({
    text: values['poll-ms'],
    fallback: DefaultPollMs,
  });
  const collector = createLogCollector({
    directory: values.dir,
    writeRecords: (text) => writeToStdout({ text }),
    report: (message) => process.stderr.write(`[collect-logs] ${message}\n`),
    now: () => Date.now(),
    deleteCollected: !values.keep,
    gapTimeoutMs: readMilliseconds({
      text: values['gap-timeout-ms'],
      fallback: DefaultGapTimeoutMs,
    }),
    incompleteTimeoutMs: readMilliseconds({
      text: values['incomplete-timeout-ms'],
      fallback: DefaultIncompleteTimeoutMs,
    }),
  });
  let stopped = false;

  process.once('SIGINT', () => {
    stopped = true;
  });
  // A closed pipe, e.g. `| head`, ends collection.
  process.stdout.on('error', (error) => {
    process.stderr.write(`[collect-logs] stdout: ${error.message}\n`);
    process.exit(1);
  });

  process.stderr.write(`[collect-logs] Watching ${values.dir}\n`);
  while (!stopped) {
    await collector.poll();
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

// Waits until stdout has taken the text, so a slow consumer slows
// collection down instead of growing a buffer.
function writeToStdout({ text }: { text: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.write(text, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

interface ReadMillisecondsArgs {
  text: string | undefined;
  fallback: number;
}

function readMilliseconds({ text, fallback }: ReadMillisecondsArgs): number {
  if (text === undefined) {
    return fallback;
  }

  const milliseconds = Number(text);

  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new Error(`Not a duration in milliseconds: ${text}`);
  }

  return milliseconds;
}
