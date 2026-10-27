import { performance } from 'node:perf_hooks';
import { runLoggerBenchmarks } from './logger-benchmarks.ts';

// The logger's cost in Node's JIT-compiled JavaScript. Says little about
// Warcraft's interpreted Lua; see lua-benchmark.ts.
process.stdout.write(`Node ${process.version}\n`);

runLoggerBenchmarks({
  readSeconds: () => performance.now() / 1000,
  report: ({ result }) => {
    const microseconds = (result.seconds * 1e6) / result.operations;

    process.stdout.write(
      `${microseconds.toFixed(3).padStart(10)} µs/op  ${result.name}\n`
    );
  },
});
