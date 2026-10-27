import { runLoggerBenchmarks } from './logger-benchmarks.ts';

// Compiled by TSTL and run by standalone Lua: the same interpreter family
// as Warcraft's Lua 5.3, so closer to in-game cost than Node, but without
// Warcraft's natives, its allocator, or the frame the game is rendering.

declare const _VERSION: string;
declare function print(this: void, text: string): void;
declare const os: { clock(this: void): number };
declare const string: {
  format(this: void, format: string, ...values: unknown[]): string;
};

print(`${_VERSION}, os.clock (process CPU time)`);

runLoggerBenchmarks({
  readSeconds: () => os.clock(),
  report: ({ result }) => {
    const microseconds = (result.seconds * 1e6) / result.operations;

    print(`${string.format('%10.3f', microseconds)} µs/op  ${result.name}`);
  },
});
