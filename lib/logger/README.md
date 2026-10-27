# `@lib/logger`

Structured logging for Warcraft III Lua maps written in TypeScript: a [Pino](https://github.com/pinojs/pino)-like logger that runs inside the game, and records that come out as Pino-compatible JSON lines.

## Lua, Warcraft and Node

The library is plain TypeScript with no runtime dependencies: it uses neither Warcraft natives nor Node.js APIs. The same code is compiled to Lua by [TypeScriptToLua](https://typescripttolua.github.io/) (TSTL) to run in Warcraft, and runs unchanged in Node.js, e.g. in tests.

Warcraft's Lua cannot write files or open connections. The only way out of the game is the preload natives, which write text files into Warcraft's `CustomMapData` folder. So logging is split in two:

```text
in the game (Lua)                                          on the host (Node.js)
logger calls → buffer → flush() → preload transport → batch files → parseBatchFile
```

- **In the game**, a logger keeps records in memory; logging does no I/O. A periodic `flush()` hands a batch of records to a transport, and the preload transport writes it to a new file. You pass in the preload natives and schedule the flushes; the library does neither itself.
- **On the host**, `parseBatchFile` reads a batch file back into its records. Watching the folder, ordering files and printing records is up to the program reading them.

Everything is imported from `@lib/logger`:

| Export                                 | Use in         | Purpose                                 |
| -------------------------------------- | -------------- | --------------------------------------- |
| `createLogger`                         | Warcraft, Node | a root logger writing to a transport    |
| `createPreloadTransport`               | Warcraft       | the transport writing batch files       |
| `parseBatchFile`, `parseBatchFileName` | Node           | reading batch files                     |
| `Logger`, `LogLevelName`               | types          | the logger and its level names          |
| `LogTransport`                         | type           | the contract of a transport             |
| `PreloadNatives`                       | type           | the natives the preload transport needs |

### Compiling with TSTL

The library expects the TSTL setup it is built and tested with: Lua 5.3, `noImplicitSelf`, so that function options such as `readTime` are called without a `self` argument, and this repository's `@lib/warcraft-tstl-plugin`, which its modules rely on to export their bindings.

## Quick start

```ts
import * as W3PreloadApi from '@lib/warcraft3-api/preload';
import {
  createLogger,
  createPreloadTransport,
  type PreloadNatives,
} from '@lib/logger';

const natives: PreloadNatives = {
  preloadGenClear: () => W3PreloadApi.PreloadGenClear(),
  preloadGenStart: () => W3PreloadApi.PreloadGenStart(),
  preload: (text) => W3PreloadApi.Preload(text),
  preloadGenEnd: (fileName) => W3PreloadApi.PreloadGenEnd(fileName),
};

const logger = createLogger({
  level: 'debug',
  transport: createPreloadTransport({ natives })({
    session: 'my-game-1',
    directory: 'MyMapLogs',
  }),
  bufferCapacity: 4096,
  batchSize: 256,
  mixin: () => ({ gameTime: readGameTime() }),
});

// Flush twice per game second.
TimerStart(CreateTimer(), 0.5, true, () => logger.flush());

logger.info('Simple message');
logger.debug({ intention: 'TowerRush' }, 'Intention activated');
logger.error({ err, component: 'Runtime' }); // msg defaults to err.message
logger.fatal(new Error('Unrecoverable error')); // recorded as `err`

const log = logger.child({ component: 'WorkerSafety' });
log.info({ actorId }, 'Worker escaping');
```

Warcraft does not report errors raised in a timer callback, so wrap the flush in whatever error reporting the map has.

## API

### `createLogger(options): Logger`

Creates a root logger. Options:

- `level`: lowest level recorded; `info` by default. `silent` records nothing.
- `transport`: where `flush` writes batches, such as a preload transport.
- `bufferCapacity`: most records held in memory, at least 2. When it is full, new records are dropped; see [dropped records](#dropped-records).
- `batchSize`: most records one `flush` writes.
- `readTime`: real-world time for each record's `time`, as the decimal digits of Unix epoch milliseconds, such as `'1793039520000'`. It is text because Warcraft's Lua [cannot hold that number](#32-bit-numbers). While it returns `undefined`, or without it, records have no `time`.
- `mixin`: like Pino's, fields evaluated on every call and added to every record, such as the current game time.
- `readClockSeconds`: a clock in seconds, such as Lua's `os.clock`, used to time each flush; without it, [flush reports](#flush-reports) carry no durations.

`createLogger({ enabled: false })` returns a logger whose calls, including `flush`, do nothing, and needs no other option.

The library knows nothing about game time, ticks, or components: add them with `mixin` for values that change on every record, and with `child` for context.

### `Logger`

- `trace`, `debug`, `info`, `warn`, `error`, `fatal`: `(message)` or `(fields, message?)`, at Pino's levels 10 to 60. As in Pino, an `Error` passed in place of fields is recorded as `err`, and a call without a message takes the message of its `err`.
- `child(bindings)`: a logger adding `bindings` to every record, after its parent's. Bindings are captured when the child is created.
- `isLevelEnabled(level)`, `level`.
- `flush()`: writes up to `batchSize` of the oldest records to the transport as one batch, and nothing when there are none. A root logger and its children share their records, so flushing any of them flushes all.

Logging calls never fail: a field that cannot be serialized is recorded as `"[Unserializable: ...]"`.

### `createPreloadTransport({ natives })({ session, directory }): LogTransport`

Writes each batch to a new file, `CustomMapData/<directory>/<session>-<batch>.txt`, numbering batches from `00000000` per session. No file is ever rewritten.

- `natives`: the four preload natives, as in the [quick start](#quick-start).
- `session`: names the log stream. Make it unique per game and per logger, such as a start time and player number; batches of two loggers with the same session collide.
- `directory`: the folder, relative to `CustomMapData`.

`CustomMapData` is `%USERPROFILE%\Documents\Warcraft III\CustomMapData\` on Windows and `~/Library/Application Support/Blizzard/Warcraft III/CustomMapData/` on macOS. Under Proton or Wine it is the Windows path inside the prefix.

The file is written synchronously, during `flush`; see [performance](#performance-in-the-game).

### `LogTransport`

The contract of a transport, for writing another one:

```ts
interface LogTransport {
  write({ batch }: { batch: { jsonl: string; recordCount: number } }): void;
}
```

`flush` calls `write` synchronously with each batch, in order. `jsonl` holds the batch's records, each a JSON object followed by `\n`.

### `parseBatchFile({ content })` and `parseBatchFileName({ fileName })`

Read the preload transport's files in Node.js. They also compile with TSTL but need `JSON`, which Warcraft's Lua lacks.

- `parseBatchFileName` returns the `session` and `batch` number of a batch file's name, and `undefined` for any other file.
- `parseBatchFile` takes a file's content decoded as UTF-8 and returns one of:
  - `{ status: 'complete', session, batch, lines, invalidLines }`: the records as JSON `lines`, and any lines that are not JSON objects, with their line numbers;
  - `{ status: 'incomplete', reason }`: the file is not fully written yet, e.g. read while the game was writing it;
  - `{ status: 'malformed', reason }`: the file is finished but unusable.

Files appear one per flush, in batch order per session, but a reader may see them late or half written. Ordering, waiting, and deciding when a missing file is gone for good are up to the reader.

## Records

One Pino JSON object per line:

```json
{
  "level": 30,
  "time": 1793039520000,
  "seq": 816,
  "component": "WorkerSafety",
  "gameTime": 38.75,
  "actorId": 12,
  "msg": "Worker escaping"
}
```

Members are written in Pino's order: `level`, `time`, then `seq`, then child bindings, mixin fields, the call's fields, and `msg`. As in Pino, a key repeated by a child and a call appears twice; JSON readers keep the last.

- `time` is real-world time, from `readTime`. Game time runs faster than real time at higher game speeds; add it yourself, e.g. with `mixin`.
- `seq` numbers the records of a root logger and its children, starting at 1. It orders records, and a gap in it shows dropped records.
- The session is not repeated in records; it is in the name of their batch file and returned by `parseBatchFile`.

### Values

Fields are captured when logged, so changing an object afterwards does not change the record. Values are serialized like Pino's safe stringify:

- circular references become `"[Circular]"`;
- values nested deeper than 5 levels become `"[Object]"` or `"[Array]"`;
- objects and arrays are cut after 100 entries;
- non-finite numbers become `null`; `undefined` values and functions are skipped;
- Warcraft handles become their Lua `tostring`, such as `"unit: 0000020CD70F7A10"`.

Errors follow Pino's default `err` serializer: `type` (the constructor's name), `message` and `stack` including the `cause` chain (`caused by: ...`), and the error's other enumerable properties. Like Pino, this applies to any error-like `err` field; unlike Pino, `Error` instances under other keys are serialized the same way instead of becoming `{}`. A Lua runtime error caught by TSTL is a string and stays one.

### Dropped records

When the buffer is full, **new records are dropped**, keeping the older ones in order. Once there is room again, a `warn` record reports what was lost before the next record:

```json
{
  "level": 40,
  "seq": 9,
  "dropped": 4,
  "firstDroppedSeq": 5,
  "lastDroppedSeq": 8,
  "msg": "Log records dropped: buffer full"
}
```

Memory stays bounded whatever happens to the transport or to whoever reads its output.

### Flush reports

At `debug` level, every flush that writes logs how long it took, as a record of the next batch. A batch holding nothing but the previous report is not reported, so an idle game writes nothing:

```json
{
  "level": 20,
  "time": 1793039580000,
  "seq": 4100,
  "records": 256,
  "bytes": 31544,
  "formatMs": 1.2,
  "writeMs": 2.5,
  "msg": "Log batch exported"
}
```

`formatMs` is the time spent turning the records into JSON and `writeMs` the time the transport took, both measured with `readClockSeconds`.

## Lua and Warcraft specifics

### Differences from Node

The same calls produce slightly different records in Lua:

- `null` is `nil` in Lua: `null` fields disappear, and an empty object or array is written as `[]`.
- Numbers are formatted by Lua, and whole floats keep `.0`, such as `40.0`.
- Object members come out in arbitrary order.
- Errors may have no stack trace, depending on the Lua runtime; `stack` is then omitted.

### 32-bit numbers

Warcraft runs Lua 5.3 built with 32-bit numbers: integers wrap past 2147483647, and floats are single precision. For logs this means:

- epoch milliseconds fit neither an integer nor a float, hence `readTime` returns text;
- floats are written with about 7 significant digits, such as `0.3333333` or `1.677722e+07`, so a time in seconds keeps millisecond precision only below 10,000.

### Performance in the game

- A logging call costs microseconds in Lua; a call below the level costs almost nothing, but the caller still builds its arguments. In frequently run code, guard calls whose arguments allocate, such as object literals:

  ```ts
  if (log.isLevelEnabled('trace')) {
    log.trace({ unitId, targetId }, 'Evaluating target');
  }
  ```

- Strings, numbers and booleans are the cheapest fields; objects and arrays are serialized during the call and cost several times more.
- `flush` formats its records and has the transport write them synchronously, during the frame that calls it. `batchSize` bounds that pause; records arriving faster than `batchSize` per flush wait in the buffer and are eventually dropped.

See [benchmarks](#benchmarks) for figures, and the flush reports for the cost in an actual game.

### Known limitations

Each batch file is written through many `Preload` calls, each limited to 259 characters. Whether Warcraft counts that limit before or after it doubles backslashes is not yet verified in-game; if after, batches with many backslashes in their records could be cut, and `parseBatchFile` reports them as malformed.

## Development

The package's scripts:

```sh
npm test            # node:test unit tests, plus the Lua compatibility test
npm run typecheck   # Node type check, and TSTL type check of the Lua code
```

Tests run in Node.js, with fake preload natives. The Lua compatibility test compiles a test driver with TSTL (`tsconfig.lua.json`), runs it in standalone Lua (`$LUA`, or `lua`), and checks that its records match Node's and that `parseBatchFile` reads back the files it writes. It is skipped when no `lua` is installed. Standalone Lua normally uses 64-bit numbers, so it does not catch [32-bit](#32-bit-numbers) overflow or precision loss unless `$LUA` is a Lua built with `LUA_32BITS`.

## Benchmarks

```sh
npm run bench:node  # the benchmarks in Node.js
npm run bench:lua   # the same benchmarks compiled by TSTL, in standalone Lua
```

The three kinds of measurement are not interchangeable:

- **Node** measures JIT-compiled JavaScript and says little about the game.
- **Standalone Lua** runs the generated Lua in the same interpreter family as Warcraft, but without the game's natives, memory allocator, or rendering. The preload natives are no-ops there, so the transport figure covers only the library's own work.
- **Warcraft** is measured only by the [flush reports](#flush-reports) of a real game.

Standalone Lua 5.4.8 on the development machine, in µs per operation:

| Operation                                           | µs   |
| --------------------------------------------------- | ---- |
| call below the level, message only                  | 0.07 |
| call below the level, fields object built by caller | 0.23 |
| call below the level, guarded by `isLevelEnabled`   | 0.08 |
| call, message only, no `readTime` or `mixin`        | 0.38 |
| call, message only, with `readTime` and `mixin`     | 1.0  |
| child call with `mixin` and 3 primitive fields      | 2.5  |
| call with nested object and array fields            | 11   |
| flush, per record                                   | 4.5  |
| preload transport, one 95 KB batch, no-op natives   | 230  |

So a 256-record flush takes about 1.2 ms of Lua work, plus whatever Warcraft takes to write the file.
