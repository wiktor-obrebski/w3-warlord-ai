# `@lib/logger`

Structured logging for Warcraft III Lua maps: a [Pino](https://github.com/pinojs/pino)-like API inside the game, Pino-compatible JSON lines outside it.

Warcraft's Lua has no file or network I/O, so logging is split between the game and the host:

```text
game thread                                                     host
logger calls → record buffer → exportBatch → batch files → parseBatchFile
 (cheap, no I/O)   (bounded)    (synchronous)                  (Node.js)
```

Everything is imported from `@lib/logger`:

| Export                                     | Runs in         | Purpose                                     |
| ------------------------------------------ | --------------- | ------------------------------------------- |
| `createPreloadLogger`                      | Warcraft (TSTL) | a root logger and the export of its records |
| `createDisabledLogger`                     | anywhere        | a logger whose calls do nothing             |
| `parseBatchFile`, `parseBatchFileName`     | Node.js         | reading batch files on the host             |
| `Logger`, `LogLevelName`, `PreloadNatives` | —               | types                                       |

The library uses no Warcraft modules or runtime globals itself: the caller passes in the preload natives and schedules the exports. Watching a folder, ordering batches and printing records is left to the program reading the files.

## Logging in the game

```ts
import * as W3PreloadApi from '@lib/warcraft3-api/preload';
import { createPreloadLogger, type PreloadNatives } from '@lib/logger';

const natives: PreloadNatives = {
  preloadGenClear: () => W3PreloadApi.PreloadGenClear(),
  preloadGenStart: () => W3PreloadApi.PreloadGenStart(),
  preload: (text) => W3PreloadApi.Preload(text),
  preloadGenEnd: (fileName) => W3PreloadApi.PreloadGenEnd(fileName),
};

const preloadLogger = createPreloadLogger({
  natives,
  level: 'debug',
  readTime,
  mixin: () => ({ gameTime: readGameTime() }),
  session,
  directory: 'MyMapLogs',
  bufferCapacity: 4096,
  batchSize: 256,
});

// Export twice per game second.
TimerStart(CreateTimer(), 0.5, true, () => preloadLogger.exportBatch());

const logger = preloadLogger.logger;

logger.info('Simple message');
logger.debug({ intention: 'TowerRush' }, 'Intention activated');
logger.error({ err, component: 'Runtime' }); // msg defaults to err.message
logger.fatal(new Error('Unrecoverable error')); // recorded as `err`

const log = logger.child({ component: 'WorkerSafety' });
log.info({ actorId }, 'Worker escaping');
```

`exportBatch` writes up to `batchSize` buffered records to a new batch file, and nothing when none are buffered. Errors raised in a timer callback are not reported by Warcraft, so wrap the call in whatever error reporting the map has.

### Options

- `natives`: the four preload natives, as above.
- `level`: lowest level recorded; `info` by default, `silent` records nothing.
- `readTime`: real-world time for `time`, as the decimal digits of Unix epoch milliseconds, written as they are; see [32-bit numbers](#32-bit-numbers). Without it, or while it returns `undefined`, records have no `time`.
- `mixin`: like Pino's, fields evaluated on every call and added to every record.
- `readClockSeconds`: a clock in seconds, such as Lua's `os.clock`, to measure each export; without it, export reports carry no durations.
- `session`: identifies the log stream in batch file names and headers. It must be unique per game and per logger, such as a start time and player number, or batches of different games collide.
- `directory`: folder for the batch files, relative to Warcraft's `CustomMapData`.
- `bufferCapacity`, `batchSize`: see [buffer](#buffer-and-drop-policy) and [export cost](#cost-on-the-game-thread).

The library knows nothing about game time, ticks, or components: the caller adds them, with `mixin` for per-record values and `child` for context.

### Logger

- `trace` / `debug` / `info` / `warn` / `error` / `fatal`: `(message)` or `(fields, message?)`. Pino's levels: 10 to 60.
- `child(bindings)`: a logger adding `bindings` to every record after its parent's. Bindings are captured when the child is created.
- `isLevelEnabled(level)`, `level`.

A call below the level returns at once, but the caller has already built its arguments. In frequently run code, guard calls whose arguments allocate, such as object literals:

```ts
if (log.isLevelEnabled('trace')) {
  log.trace({ unitId, targetId }, 'Evaluating target');
}
```

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

- `time` is real-world time. Game time, which runs faster than real time at higher game speeds, is for the caller to add, e.g. with `mixin`.
- `seq` numbers every record of a logger tree that passed its logger's level, starting at 1. It orders records and exposes gaps from dropped records.
- Records do not repeat the session; it is in the name and header of their batch file.

### Values

Fields are captured when logged: strings, numbers and booleans are kept as they are, and any other value is serialized immediately, so later mutation does not change the record. Serialization follows Pino's safe stringify: circular references become `"[Circular]"`, values nested deeper than 5 levels become `"[Object]"`/`"[Array]"`, and objects and arrays are cut after 100 entries. Non-finite numbers become `null`, and `undefined` values and functions are skipped. Warcraft handles become their Lua `tostring`, such as `"unit: 0000020CD70F7A10"`.

Errors follow Pino's default `err` serializer: `type` (the constructor's name), `message` and `stack` including the `cause` chain (`caused by: ...`), and the error's other enumerable properties. Like Pino, this applies to any error-like `err` field. Unlike Pino, `Error` instances under other keys are serialized the same way instead of becoming `{}`. A Lua runtime error caught by TSTL is a string and stays one.

Lua differs from Node in ways the library cannot hide:

- `null` is `nil`: `null` fields disappear, and an empty table is written as `[]`.
- Numbers are formatted by Lua's `tostring`, and whole floats keep `.0`, such as `40.0`.
- Object members come out in arbitrary order.
- Errors raised in Warcraft have no stack trace when the runtime provides no real `debug` library; `stack` is then omitted.

### 32-bit numbers

Warcraft runs Lua 5.3 built with 32-bit numbers, as an in-game probe showed: `math.maxinteger` is 2147483647, `2147483647 + 1` wraps to -2147483648, and floats are single precision, so `0.1` is `0.10000000149011612`. An early version computed `os.time() * 1000`, which wrapped around to `2047466568` instead of `1793048829000`.

For logs this means:

- `time` is passed as text by `readTime` and written as it is, since epoch milliseconds fit neither an integer nor a float.
- Floats are written with 7 significant digits, such as `0.3333333` or `1.677722e+07`; a time in seconds keeps millisecond precision only below 10,000.
- Integers such as `seq` and batch numbers stay far below 2^31.

## Buffer and drop policy

Records are kept in a ring of `bufferCapacity` records (at least 2). Logging calls only store records; they never do I/O. When the buffer is full, **new records are dropped** and counted, keeping the older records in order. Once two slots are free again, a `warn` record is stored before the next one:

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

Memory stays bounded whatever happens to the export or to whoever reads the files. Records are formatted into JSON only when they are exported. Short strings and member keys, which repeat in most records, are escaped once and cached, with each cache limited to 1024 entries.

## Preload transport

Warcraft can write files only through the preload natives. Each export calls `PreloadGenClear`, `PreloadGenStart`, `Preload` once per chunk of content, `PreloadGenEnd(file)`, and `PreloadGenClear` again. This is the technique of the community FileIO libraries, such as [w3ts's `File`](https://github.com/cipherxof/w3ts/blob/master/system/file.ts). This library only writes, so it needs none of their read-back code.

Every batch is a new file, `CustomMapData/<directory>/<session>-<batch>.txt`, where the batch number is zero-padded to 8 digits and counts from 0 per session. No file is ever rewritten. Joined, the `Preload` arguments are a JSON header line followed by the batch's records, one JSON line each:

```text
{"format":"warlord-log-batch","version":1,"session":"1793039520000-p1","batch":7,"records":120,"bytes":18233}
```

`bytes` is the length of the records text in Lua, which counts UTF-8 bytes. Together with `records` and the trailer `PreloadGenEnd` writes, it tells a complete batch from a truncated one.

What the format relies on, from [Jassdoc](https://github.com/lep/jassdoc) and community FileIO code:

- A `Preload` argument may be up to 259 characters, so arguments are cut at no more than 255 bytes, and never inside a UTF-8 character, so the file is valid UTF-8 text. A NUL ends an argument; JSON escapes every control character, so records contain none.
- `Preload` writes `\` as `\\` and everything else as is, including `"` and line feeds. Records never contain a raw tab or carriage return, and a line feed in them always follows `}`, so the line structure of the file cannot be forged by record content.
- `PreloadGenEnd` does not clear its buffer, so every batch starts with `PreloadGenClear`.
- Files are confined to `CustomMapData`: `%USERPROFILE%\Documents\Warcraft III\CustomMapData\` on Windows, and `~/Library/Application Support/Blizzard/Warcraft III/CustomMapData/` on macOS. Under Proton or Wine it is the Windows path inside the prefix: `<prefix>/drive_c/users/<user>/Documents/Warcraft III/CustomMapData/`, where `<user>` is `steamuser` under Proton. Only `.txt` and `.pld` files can be written.
- `Preload` also asks the game to cache a file named by its argument. Jassdoc says the game reads in a separate thread, but every argument is a lookup the game did not need, which is one more reason to send few, full arguments.

Not yet verified in-game: that `PreloadGenEnd` creates a missing folder, and that the 259-character limit applies before backslashes are doubled; otherwise `parseBatchFile` reports such batches as malformed for their byte count.

### Cost on the game thread

Buffering does not make the export asynchronous. Each export drains up to `batchSize` records, formats them, and writes one file synchronously on the game thread, so `batchSize` bounds the pause of one export. Records arriving faster than `batchSize` per export wait in the buffer and are eventually dropped. Empty exports write nothing.

Each export measures itself and logs a `debug` record, unless the batch held nothing but the previous report:

```json
{
  "level": 20,
  "time": 1793039580000,
  "seq": 4100,
  "records": 256,
  "bytes": 31544,
  "formatMs": 1,
  "writeMs": 2,
  "msg": "Log batch exported"
}
```

`formatMs` and `writeMs` are differences of `readClockSeconds`; Lua's `os.clock` follows real time in-game.

## Reading batch files

These run in Node.js; they compile under TSTL but rely on `JSON`, which Warcraft's Lua lacks.

- `parseBatchFileName({ fileName })` returns the `session` and `batch` number of a batch file's name, and `undefined` for any other file.
- `parseBatchFile({ content })` takes the file's content decoded as UTF-8 and returns one of:
  - `complete`, with the header's `session` and `batch`, the records as JSON `lines`, and `invalidLines`, the lines that are not JSON objects;
  - `incomplete`, when the trailer `PreloadGenEnd` writes last is missing, e.g. while the game is still writing the file;
  - `malformed`, when the file is finished but its header is invalid or does not match its content.

Files appear in batch order per session, one per export, but a reader may see them late or partially written. Ordering, waiting, and deciding when a file is gone for good are up to the reader.

## Development

The package's scripts:

```sh
npm test            # node:test unit tests, plus the Lua compatibility test
npm run typecheck   # Node type check, and TSTL type check of the Lua code
npm run bench:node  # the logger in Node.js
npm run bench:lua   # the same benchmarks compiled by TSTL, in standalone Lua
```

The library depends on neither Warcraft nor Node, so it is unit tested in Node, with fake preload natives, and, compiled by TSTL with `tsconfig.lua.json`, checked in standalone Lua. `tests/lua-compat.test.ts` runs a driver in `lua` (or `$LUA`) and checks that its records match Node's and that `parseBatchFile` reads back the batch files it writes. It is skipped when no `lua` is installed. The installed `lua` normally uses 64-bit numbers, so it catches no [32-bit](#32-bit-numbers) overflow or precision loss unless `$LUA` is a Lua built with `LUA_32BITS`.

The three kinds of measurement are not interchangeable:

- **Node** (`bench:node`) measures JIT-compiled JavaScript and says little about the game.
- **Standalone Lua** (`bench:lua`) runs the generated Lua in the same interpreter family as Warcraft, without the game's natives, allocator, or frame load. Natives are no-ops there, so the transport figure is only the cost of cutting the content into chunks.
- **Warcraft** is measured only by the export's own `Log batch exported` records, from a real game.

Standalone Lua 5.4.8 on the development machine (µs per operation):

| Operation                                         | µs   |
| ------------------------------------------------- | ---- |
| disabled level, message only                      | 0.07 |
| disabled level, fields object built by the caller | 0.23 |
| disabled level, guarded by `isLevelEnabled`       | 0.08 |
| enabled, message only, no time or mixin           | 0.38 |
| enabled, message only, with time and mixin        | 1.0  |
| enabled, child, mixin and 3 primitive fields      | 2.5  |
| enabled, nested object and array fields           | 11   |
| drain and format, per record                      | 4.4  |
| cutting a 95 KB batch into `Preload` arguments    | 98   |

A 256-record export spends about 1.1 ms formatting in standalone Lua, plus whatever `PreloadGenEnd` takes to write the file in the game.
