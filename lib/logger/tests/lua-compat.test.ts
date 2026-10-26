import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createLogCollector } from '../collector/log-collector';
import { createLogger } from '../create-logger';
import { createLogRecordBuffer } from '../record-buffer';
import { runLoggingScenario, SCENARIO_TIME } from './support/logging-scenario';

// Compiles the logger with TSTL and runs it in standalone Lua (`$LUA`, or
// `lua`), comparing its records with Node's and collecting the batch files
// it writes. Warcraft runs Lua 5.3; the installed `lua` may differ.
const LuaCommand = process.env.LUA ?? 'lua';
const IsLuaAvailable =
  spawnSync(LuaCommand, ['-v'], { stdio: 'ignore' }).status === 0;

describe(
  'Lua compatibility',
  { skip: !IsLuaAvailable && `${LuaCommand} not found` },
  () => {
    let workDirectory: string;
    let batchDirectory: string;
    let luaLines: string[];

    before(async () => {
      workDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'warlord-lua-'));
      batchDirectory = path.join(workDirectory, 'batches');
      await fs.mkdir(batchDirectory);

      execFileSync(
        'npx',
        [
          'tstl',
          '-p',
          'tsconfig.lua-harness.json',
          '--outDir',
          workDirectory,
          '--luaBundle',
          'driver.lua',
          '--luaBundleEntry',
          'lib/logger/tests/lua/lua-compat-driver.ts',
        ],
        { cwd: RepositoryRoot, stdio: 'pipe' }
      );

      const output = execFileSync(LuaCommand, ['driver.lua', batchDirectory], {
        cwd: workDirectory,
        encoding: 'utf8',
      });
      luaLines = output.split('\n').filter((line) => line !== '');
    });

    after(async () => {
      await fs.rm(workDirectory, { recursive: true, force: true });
    });

    it('writes the same records as Node', () => {
      assert.deepEqual(
        luaLines.map((line) => withoutStacks(JSON.parse(line))),
        runScenarioInNode().map((line) => withoutStacks(JSON.parse(line)))
      );
    });

    it('writes batch files the collector reassembles exactly', async () => {
      const written: string[] = [];
      const reports: string[] = [];
      const collector = createLogCollector({
        directory: batchDirectory,
        writeRecords: (text) => {
          written.push(text);
          return Promise.resolve();
        },
        report: (message) => reports.push(message),
        now: () => Date.now(),
        deleteCollected: true,
        gapTimeoutMs: 0,
        incompleteTimeoutMs: 0,
      });

      await collector.poll();

      assert.deepEqual(reports, []);
      assert.deepEqual(
        written
          .join('')
          .split('\n')
          .filter((line) => line !== ''),
        luaLines.map((line) => `{"session":"lua-session",${line.slice(1)}`)
      );
    });
  }
);

const RepositoryRoot = path.resolve(__dirname, '../../..');

function runScenarioInNode(): string[] {
  const buffer = createLogRecordBuffer({ capacity: 1000 });
  let gameTime = 0;
  const logger = createLogger({
    level: 'debug',
    buffer,
    readTime: () => SCENARIO_TIME,
    mixin: () => {
      gameTime += 0.25;
      return { gameTime };
    },
  });

  runLoggingScenario({ logger });

  return buffer
    .drain({ maxRecords: 1000 })
    .jsonl.split('\n')
    .filter((line) => line !== '');
}

// Stack traces differ between the runtimes by nature.
function withoutStacks(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(withoutStacks);
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'stack')
      .map(([key, entryValue]) => [key, withoutStacks(entryValue)])
  );
}
