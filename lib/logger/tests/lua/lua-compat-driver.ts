import { createLogger } from '../../create-logger';
import { createPreloadTransport } from '../../preload-transport';
import { createLogRecordBuffer } from '../../record-buffer';
import { createFakePreloadEngine } from '../support/fake-preload-engine';
import { runLoggingScenario, SCENARIO_TIME } from '../support/logging-scenario';

// Compiled by TSTL and run by standalone Lua for `lua-compat.test.ts`:
// runs the logging scenario, prints the drained JSON lines, and writes the
// batch files to the folder given as the first argument.

declare const arg: string[];
declare const io: {
  open(this: void, path: string, mode: string): LuaFile | undefined;
  write(this: void, text: string): void;
};

interface LuaFile {
  write(text: string): void;
  close(): void;
}

const BatchSize = 10;

const engine = createFakePreloadEngine({
  writeFile: ({ fileName, content }) => {
    const file = io.open(fileName, 'wb');

    if (file === undefined) {
      throw new Error(`Cannot write ${fileName}`);
    }
    file.write(content);
    file.close();
  },
});
const transport = createPreloadTransport({ natives: engine.natives })({
  session: 'lua-session',
  directory: arg[0]!,
});
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

for (
  let batch = buffer.drain({ maxRecords: BatchSize });
  batch.recordCount > 0;
  batch = buffer.drain({ maxRecords: BatchSize })
) {
  io.write(batch.jsonl);
  transport.write({ batch });
}
