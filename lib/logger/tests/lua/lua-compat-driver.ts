import { createPreloadTransport } from '../../preload/preload-transport';
import { createFakePreloadEngine } from '../support/fake-preload-engine';
import { logScenario } from '../support/logging-scenario';

// Compiled by TSTL and run by standalone Lua for `lua-compat.test.ts`:
// logs the scenario, prints the flushed JSON lines, and writes the batch
// files to the folder given as the first argument.

declare const arg: string[];
declare const io: {
  open(this: void, path: string, mode: string): LuaFile | undefined;
  write(this: void, text: string): void;
};

interface LuaFile {
  write(text: string): void;
  close(): void;
}

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
const preloadTransport = createPreloadTransport({ natives: engine.natives })({
  session: 'lua-session',
  directory: arg[0]!,
});

logScenario({
  transport: {
    write({ batch }) {
      io.write(batch.jsonl);
      preloadTransport.write({ batch });
    },
  },
});
