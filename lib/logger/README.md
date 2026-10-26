# `@lib/logger`

Structured logging for the Warlord bot: a [Pino](https://github.com/pinojs/pino)-like API inside Warcraft III, Pino-compatible JSON lines outside it.

Warcraft's Lua has no file or network I/O, so the library is split into three parts:

```text
game thread                                         host
logger calls → record buffer → transport → batch files → collector → stdout (JSONL)
   (cheap, no I/O)   (bounded)   (periodic, synchronous)      (Node.js)
```

| Part              | Module                                   | Runs in       |
| ----------------- | ---------------------------------------- | ------------- |
| Runtime logger    | `@lib/logger` (`createLogger`)           | Lua and Node  |
| Record buffer     | `@lib/logger` (`createLogRecordBuffer`)  | Lua and Node  |
| Preload transport | `@lib/logger` (`createPreloadTransport`) | Lua and Node  |
| Warcraft export   | `@lib/logger/warcraft`                   | Warcraft only |
| Collector         | `collector/collect-logs.ts`              | Node only     |

Everything but `@lib/logger/warcraft` is free of Warcraft natives, so it is unit tested in Node and, compiled by TSTL, checked in standalone Lua.

## Usage

```ts
import { createLogger, createLogRecordBuffer } from '@lib/logger';
import { startWarcraftLogExport } from '@lib/logger/warcraft';

const buffer = createLogRecordBuffer({ capacity: 4096 });
const logger = createLogger({
  level: 'debug',
  buffer,
  readTime: () => WarlordApi.readWallClockMilliseconds(),
  mixin: () => ({ gameTime: readGameClock({ clock }) }),
});

startWarcraftLogExport({
  buffer,
  logger,
  session,
  directory: 'WarlordLogs',
  flushIntervalSeconds: 0.5,
  batchSize: 256,
});

logger.info('Simple message');
logger.debug({ intention: 'TowerRush' }, 'Intention activated');
logger.error({ err, component: 'Runtime' }); // msg defaults to err.message
logger.fatal(new Error('Unrecoverable error')); // recorded as `err`

const log = logger.child({ component: 'WorkerSafety' });
log.info({ actorId }, 'Worker escaping');
```

The bot's configuration (level, capacity, batch size, flush interval, folder, on/off) is in `src/logging.ts`.

### API

- `trace` / `debug` / `info` / `warn` / `error` / `fatal`: `(message)` or `(fields, message?)`. Pino's levels: 10 to 60.
- `child(bindings)`: a logger adding `bindings` to every record after its parent's. Bindings are captured when the child is created.
- `isLevelEnabled(level)`, `level`.
- Options: `level` (default `info`; `silent` records nothing), `enabled: false` (every call is a no-op and no buffer is needed), `readTime` (real-world time for `time`, in Unix epoch milliseconds), and `mixin` (like Pino's: fields evaluated on every call, such as `gameTime`).

The library knows nothing about game time, ticks, or components: the consumer adds them, with `mixin` for per-record values and `child` for context.

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

- `time` is real-world time; it is missing while `readTime` returns `undefined`. In the bot, `gameTime` is simulation time, which runs faster than real time at higher game speeds.
- `seq` numbers every record of a buffer that passed its logger's level, starting at 1. It orders records and exposes gaps from dropped records.
- `session`, the game and bot the record came from, is added by the collector.

### Values

Fields are captured when logged: strings, numbers and booleans are kept as they are, and any other value is serialized immediately, so later mutation does not change the record. Serialization follows Pino's safe stringify: circular references become `"[Circular]"`, values nested deeper than 5 levels become `"[Object]"`/`"[Array]"`, and objects and arrays are cut after 100 entries. Non-finite numbers become `null`, and `undefined` values and functions are skipped. Warcraft handles become their Lua `tostring`, such as `"unit: 0000020CD70F7A10"`.

Errors follow Pino's default `err` serializer: `type` (the constructor's name), `message` and `stack` including the `cause` chain (`caused by: ...`), and the error's other enumerable properties. Like Pino, this applies to any error-like `err` field. Unlike Pino, `Error` instances under other keys are serialized the same way instead of becoming `{}`. A Lua runtime error caught by TSTL is a string and stays one.

Lua differs from Node in ways the library cannot hide:

- `null` is `nil`: `null` fields disappear, and an empty table is written as `[]`.
- Numbers are formatted by Lua's `tostring`, with 14 significant digits, and whole floats keep `.0`, such as `40.0`.
- Object members come out in arbitrary order.
- Warcraft errors have no stack traces, since the runtime wrapper provides no real `debug` library; `stack` is then omitted.

## Buffer and drop policy

The buffer is a ring with a fixed `capacity` (at least 2). Logging calls only store records; they never do I/O. When the buffer is full, **new records are dropped** and counted, keeping the older records in order. Once two slots are free again, a `warn` record is stored before the next one:

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

Memory stays bounded whatever happens to the transport or collector. The buffer formats records into JSON only when they are drained. Short strings and member keys, which repeat in most records, are escaped once and cached, with each cache limited to 1024 entries.

## Preload transport

Warcraft can write files only through the preload natives. Each export calls `PreloadGenClear`, `PreloadGenStart`, `Preload` once per chunk of content, `PreloadGenEnd(file)`, and `PreloadGenClear` again. This is the technique of the community FileIO libraries, such as [w3ts's `File`](https://github.com/cipherxof/w3ts/blob/master/system/file.ts). This library only writes, so it needs none of their read-back code.

Every batch is a new file, `CustomMapData/<directory>/<session>-<batch>.txt`, where the batch number is zero-padded to 8 digits and counts from 0 per session. No file is ever rewritten. Joined, the `Preload` arguments are a JSON header line followed by the batch's records, one JSON line each:

```text
{"format":"warlord-log-batch","version":1,"session":"1793039520000-p1","batch":7,"records":120,"bytes":18233}
```

`bytes` is the length of the records text in Lua, which counts UTF-8 bytes. Together with `records` and the trailer `PreloadGenEnd` writes, it lets the collector tell a complete batch from a truncated one.

What the format relies on, from [Jassdoc](https://github.com/lep/jassdoc) and community FileIO code:

- A `Preload` argument may be up to 259 characters, so arguments are cut at 255 bytes, possibly inside a UTF-8 character; the collector joins them byte-exactly. A NUL ends an argument; JSON escapes every control character, so records contain none.
- `Preload` writes `\` as `\\` and everything else as is, including `"` and line feeds. Records never contain a raw tab or carriage return, and a line feed in them always follows `}`, so the line structure of the file cannot be forged by record content.
- `PreloadGenEnd` does not clear its buffer, so every batch starts with `PreloadGenClear`.
- Files are confined to `CustomMapData`: `%USERPROFILE%\Documents\Warcraft III\CustomMapData\` on Windows, and `~/Library/Application Support/Blizzard/Warcraft III/CustomMapData/` on macOS. Under Proton or Wine it is the Windows path inside the prefix: `<prefix>/drive_c/users/<user>/Documents/Warcraft III/CustomMapData/`, where `<user>` is `steamuser` under Proton. Only `.txt` and `.pld` files can be written.
- `Preload` also asks the game to cache a file named by its argument. Jassdoc says the game reads in a separate thread, but every argument is a lookup the game did not need, which is one more reason to send few, full arguments.

Not yet verified in-game, to be checked with the first real run: that `PreloadGenEnd` creates the `WarlordLogs` folder, that the 259-character limit applies before backslashes are doubled (otherwise the collector rejects the batch for its byte count), and the exact whitespace and line endings of the file. The collector accepts tabs or spaces and LF or CRLF.

### Cost on the game thread

Buffering does not make the export asynchronous. Each export drains up to `batchSize` records, formats them, and writes one file synchronously on the game thread, so `batchSize` bounds the pause of one export. Records arriving faster than `batchSize` per `flushIntervalSeconds` wait in the buffer and are eventually dropped. Empty exports write nothing.

Each export measures itself and logs a `debug` record, unless the batch held nothing but the previous report:

```json
{
  "level": 20,
  "time": 1793039580000,
  "seq": 4100,
  "gameTime": 60.5,
  "records": 256,
  "bytes": 31544,
  "formatMs": 1,
  "writeMs": 2,
  "msg": "Log batch exported"
}
```

`formatMs` and `writeMs` come from the runtime wrapper's wall clock, accurate to about a millisecond on Windows.

## Collector

```sh
npm run collect-logs -- --dir "<CustomMapData>/WarlordLogs" | npx pino-pretty
npm run collect-logs -- --dir "<CustomMapData>/WarlordLogs" > game.jsonl
```

The collector polls the folder (every 250 ms by default) and writes every record to stdout as one JSON line with `session` added, in batch order per session. Diagnostics go to stderr. It writes a batch only after stdout has taken the previous one, so a slow consumer slows collection instead of growing memory. Unwritten batches wait on disk.

- **Ordering**: a session starts at its lowest batch present. A missing batch is waited for (`--gap-timeout-ms`, default 10 s), then reported and skipped.
- **Completeness**: a file without the trailer is still being written. If it stays like that for `--incomplete-timeout-ms` (default 10 s), it is rejected. A file whose header does not match its content is rejected at once. Rejected files are renamed to `*.rejected` and kept. Record lines that are not JSON objects are reported and skipped.
- **Duplicates and restarts**: after writing a batch, the collector saves the session's next batch number to `.warlord-collector-state.json` in the folder, then deletes the file (`--keep` leaves it). A batch numbered below that is never written again.

Reliability limits:

- Delivery is at least once: a crash after writing a batch but before saving its progress writes that batch again on restart.
- Handing records to stdout is not durable storage. Records already written to a pipe whose consumer then fails are lost, since the source file is already deleted. Use `--keep`, or write to a file first (`> game.jsonl`, `tee`), when the logs matter.
- The state file keeps one entry per session ever collected from that folder.
- Records the game dropped, or never wrote because it crashed or quit before the next export, are not recoverable. `seq` gaps and drop records show where they were.

## Tests and benchmarks

```sh
npm test            # node:test unit tests, plus the Lua compatibility test
npm run bench:node  # the logger in Node.js
npm run bench:lua   # the same benchmarks compiled by TSTL, in standalone Lua
```

`tests/lua-compat.test.ts` compiles a driver with TSTL (`tsconfig.lua-harness.json`), runs it in `lua` (or `$LUA`), and checks that its records match Node's and that the collector reassembles the batch files it writes. It is skipped when no `lua` is installed. Warcraft runs Lua 5.3; the installed `lua` may be a later version.

The three kinds of measurement are not interchangeable:

- **Node** (`bench:node`) measures JIT-compiled JavaScript and says little about the game.
- **Standalone Lua** (`bench:lua`) runs the generated Lua in the same interpreter family as Warcraft, without the game's natives, allocator, or frame load. Natives are no-ops there, so the transport figure is only the cost of cutting the content into chunks.
- **Warcraft** is measured only by the export's own `Log batch exported` records, from a real game.

Standalone Lua 5.4.8 on the development machine (µs per operation):

| Operation                                         | µs   |
| ------------------------------------------------- | ---- |
| disabled level, message only                      | 0.09 |
| disabled level, fields object built by the caller | 0.37 |
| disabled level, guarded by `isLevelEnabled`       | 0.10 |
| enabled, message only, no time or mixin           | 0.46 |
| enabled, message only, with time and mixin        | 1.2  |
| enabled, child, mixin and 3 primitive fields      | 2.8  |
| enabled, nested object and array fields           | 12   |
| drain and format, per record                      | 5.4  |
| cutting a 95 KB batch into `Preload` arguments    | 120  |

A 256-record export spends about 1.4 ms formatting in standalone Lua, plus whatever `PreloadGenEnd` takes to write the file in the game.
