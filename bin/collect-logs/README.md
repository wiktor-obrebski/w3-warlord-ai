# collect-logs

Collects the bot's log batch files while the game runs and writes their records to stdout as Pino JSON lines, so they can be piped into `pino-pretty`, `jq`, a file, or any other tool. Diagnostics go to stderr.

```sh
npm run collect-logs -- --dir "<CustomMapData>/WarlordLogs" | npx pino-pretty
npm run collect-logs -- --dir "<CustomMapData>/WarlordLogs" > game.jsonl
```

`<CustomMapData>` is `Documents/Warcraft III/CustomMapData`. Under Proton or Wine it is inside the prefix: `<prefix>/drive_c/users/<user>/Documents/Warcraft III/CustomMapData`, where `<user>` is `steamuser` under Proton. The bot's logging is configured in `src/logging.ts`.

| Option                         | Default | Meaning                                     |
| ------------------------------ | ------- | ------------------------------------------- |
| `--dir <folder>`               |         | the batch files' folder; must exist         |
| `--poll-ms <ms>`               | 250     | how often to look for new batches           |
| `--gap-timeout-ms <ms>`        | 10000   | how long to wait for a missing batch        |
| `--incomplete-timeout-ms <ms>` | 10000   | how long a batch file may stay half written |
| `--keep`                       |         | leave collected batch files in place        |

The batch file format and how files are read are described by [`@lib/logger`](../../lib/logger/README.md).

## Behavior

Every record is written as one line of the game's own JSON, with `session` added first. Records come in batch order per session. A batch is written only after stdout has taken the previous one, so a slow consumer slows collection instead of growing memory; unwritten batches wait on disk.

- **Ordering**: a session starts at its lowest batch present. A missing batch is waited for (`--gap-timeout-ms`), then reported and skipped.
- **Completeness**: a file without its trailer is still being written. If it stays like that for `--incomplete-timeout-ms`, it is rejected. A file whose header does not match its content is rejected at once. Rejected files are renamed to `*.rejected` and kept. Record lines that are not JSON objects are reported and skipped.
- **Duplicates and restarts**: after writing a batch, the collector saves the session's next batch number to `.warlord-collector-state.json` in the folder, then deletes the file (`--keep` leaves it). A batch numbered below that is never written again.
- **Missing folder**: the collector exits with an error when the folder does not exist, or stops being one, rather than waiting for a mistyped path. The game creates it with its first export, so start a game first or create it.

## Reliability limits

- Delivery is at least once: a crash after writing a batch but before saving its progress writes that batch again on restart.
- Handing records to stdout is not durable storage. Records already written to a pipe whose consumer then fails are lost, since the source file is already deleted. Use `--keep`, or write to a file first (`> game.jsonl`, `tee`), when the logs matter.
- The state file keeps one entry per session ever collected from that folder.
- Records the game dropped, or never wrote because it crashed or quit before the next export, are not recoverable. `seq` gaps and drop records show where they were.
