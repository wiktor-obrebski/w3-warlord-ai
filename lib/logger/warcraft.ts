import * as W3PreloadApi from '@lib/warcraft3-api/preload';
import * as W3TimerApi from '@lib/warcraft3-api/timer';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import type { Logger } from './create-logger';
import {
  createPreloadTransport,
  type PreloadNatives,
} from './preload-transport';
import type { LogRecordBuffer } from './record-buffer';

export { startWarcraftLogExport, type WarcraftLogExport };

interface WarcraftLogExport {
  /** Exports one batch now, e.g. before an expected crash. */
  flush(): void;
}

interface StartWarcraftLogExportArgs {
  buffer: LogRecordBuffer;
  /** Receives a `debug` report of each export's duration. */
  logger: Logger;
  /** Identifies the log stream; see `createPreloadTransport`. */
  session: string;
  /** Folder for the batch files, relative to Warcraft's `CustomMapData`. */
  directory: string;
  /** Game seconds between exports. */
  flushIntervalSeconds: number;
  /** Most records written to one batch file. */
  batchSize: number;
}

/**
 * Exports the buffer's records to preload files every flush interval, at
 * most one batch file per export. Records beyond the batch size wait for
 * the next export, which bounds the synchronous work done on one frame; the
 * buffer drops records when they arrive faster than they are exported.
 */
function startWarcraftLogExport({
  buffer,
  logger,
  session,
  directory,
  flushIntervalSeconds,
  batchSize,
}: StartWarcraftLogExportArgs): WarcraftLogExport {
  const transport = createPreloadTransport({ natives: WarcraftPreloadNatives })(
    { session, directory }
  );
  const timer = W3TimerApi.CreateTimer();

  const exportBatch = () => {
    const startedAt = WarlordApi.readWallClockMilliseconds();
    const batch = buffer.drain({ maxRecords: batchSize });

    if (batch.recordCount === 0) {
      return;
    }

    const formattedAt = WarlordApi.readWallClockMilliseconds();
    transport.write({ batch });
    const writtenAt = WarlordApi.readWallClockMilliseconds();

    // A batch holding nothing but the previous batch's report would keep an
    // idle game writing a file every interval.
    if (batch.recordCount > 1 && logger.isLevelEnabled('debug')) {
      logger.debug(
        {
          records: batch.recordCount,
          bytes: batch.jsonl.length,
          formatMs: elapsedMilliseconds({ from: startedAt, to: formattedAt }),
          writeMs: elapsedMilliseconds({ from: formattedAt, to: writtenAt }),
        },
        'Log batch exported'
      );
    }
  };

  W3TimerApi.TimerStart(
    timer,
    flushIntervalSeconds,
    true,
    WarlordApi.guard(exportBatch)
  );

  return {
    flush() {
      exportBatch();
    },
  };
}

const WarcraftPreloadNatives: PreloadNatives = {
  preloadGenClear: () => W3PreloadApi.PreloadGenClear(),
  preloadGenStart: () => W3PreloadApi.PreloadGenStart(),
  preload: (text) => W3PreloadApi.Preload(text),
  preloadGenEnd: (fileName) => W3PreloadApi.PreloadGenEnd(fileName),
};

interface ElapsedMillisecondsArgs {
  from: number | undefined;
  to: number | undefined;
}

function elapsedMilliseconds({
  from,
  to,
}: ElapsedMillisecondsArgs): number | undefined {
  return from === undefined || to === undefined ? undefined : to - from;
}
