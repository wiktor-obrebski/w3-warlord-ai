import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { parseBatchFile, parseBatchFileName } from '../batch-file';
import { logScenario } from './support/logging-scenario';
import { createMemoryTransport } from './support/memory-transport';

// Compiles the logger with TSTL and runs it in standalone Lua (`$LUA`, or
// `lua`), comparing its records with Node's and reading back the batch
// files it writes. Warcraft runs Lua 5.3; the installed `lua` may differ.
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
          'tsconfig.lua.json',
          '--outDir',
          workDirectory,
          '--luaBundle',
          'driver.lua',
          '--luaBundleEntry',
          'tests/lua/lua-compat-driver.ts',
        ],
        { cwd: LibraryRoot, stdio: 'pipe' }
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
        luaLines.map((line) => comparable(JSON.parse(line))),
        runScenarioInNode().map((line) => comparable(JSON.parse(line)))
      );
    });

    it('writes batch files parseBatchFile reassembles exactly', async () => {
      const fileNames = (await fs.readdir(batchDirectory)).sort();
      const lines: string[] = [];

      for (const [batch, fileName] of fileNames.entries()) {
        const parsed = parseBatchFile({
          content: await fs.readFile(
            path.join(batchDirectory, fileName),
            'utf8'
          ),
        });

        assert.deepEqual(parseBatchFileName({ fileName }), {
          session: 'lua-session',
          batch,
        });
        assert.ok(parsed.status === 'complete', JSON.stringify(parsed));
        assert.deepEqual(parsed.invalidLines, []);
        lines.push(...parsed.lines);
      }

      assert.deepEqual(lines, luaLines);
    });
  }
);

const LibraryRoot = path.resolve(__dirname, '..');

function runScenarioInNode(): string[] {
  const transport = createMemoryTransport();

  logScenario({ transport });

  return transport.readLines();
}

// Differ between the runtimes by nature: stack traces, and the length of a
// batch, which Lua counts in bytes and JavaScript in UTF-16 code units.
function comparable(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(comparable);
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'stack' && key !== 'bytes')
      .map(([key, entryValue]) => [key, comparable(entryValue)])
  );
}
