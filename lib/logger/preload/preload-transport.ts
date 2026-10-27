import type { LogTransport } from '../core/log-transport.ts';
import { serializeJson } from '../json/json.ts';

export {
  createPreloadTransport,
  PRELOAD_BATCH_FORMAT,
  PRELOAD_CHUNK_LENGTH,
  type PreloadNatives,
};

/** `format` of every batch header. */
const PRELOAD_BATCH_FORMAT = 'warlord-log-batch';

/**
 * Longest text passed to one `Preload` call. Jassdoc caps the argument at
 * 259 characters.
 */
const PRELOAD_CHUNK_LENGTH = 255;

/** The Warcraft natives generating preload files. */
interface PreloadNatives {
  preloadGenClear(): void;
  preloadGenStart(): void;
  preload(text: string): void;
  preloadGenEnd(fileName: string): void;
}

interface CreatePreloadTransportArgs {
  /** Identifies the log stream; part of file names. */
  session: string;
  /** Folder for the batch files, relative to Warcraft's `CustomMapData`. */
  directory: string;
}

/**
 * Writes each batch to a new preload file, `<directory>/<session>-<batch>.txt`,
 * numbering batches from 0 and never rewriting an earlier file.
 *
 * The file's `Preload` arguments, joined, are a header line followed by the
 * batch's JSON lines. The header is JSON with `format`, `version`,
 * `session`, `batch`, `records`, and `bytes`, the length of the JSON lines,
 * which in Lua is their size in bytes. The JSON lines never contain the
 * file's own line structure, and arguments are never cut inside a UTF-8
 * character, so `parseBatchFile` can read the file as text and split the
 * arguments apart again.
 *
 * Writing is synchronous: `PreloadGenEnd` writes the file on the game
 * thread.
 */
const createPreloadTransport =
  ({ natives }: { natives: PreloadNatives }) =>
  ({ session, directory }: CreatePreloadTransportArgs): LogTransport => {
    let batchNumber = 0;

    return {
      write({ batch }) {
        const header = serializeJson({
          value: {
            format: PRELOAD_BATCH_FORMAT,
            version: 1,
            session,
            batch: batchNumber,
            records: batch.recordCount,
            bytes: batch.jsonl.length,
          },
        });
        const content = `${header}\n${batch.jsonl}`;

        // `PreloadGenEnd` keeps the buffer, and other code may preload too.
        natives.preloadGenClear();
        natives.preloadGenStart();
        for (let offset = 0; offset < content.length;) {
          const end = chunkEnd({ content, offset });

          natives.preload(content.substring(offset, end));
          offset = end;
        }
        natives.preloadGenEnd(
          `${directory}/${session}-${formatBatchNumber({ batchNumber })}.txt`
        );
        natives.preloadGenClear();

        batchNumber += 1;
      },
    };
  };

interface ChunkEndArgs {
  content: string;
  offset: number;
}

// Where the `Preload` argument starting at `offset` ends: at most
// `PRELOAD_CHUNK_LENGTH` later, but never inside a UTF-8 character, so the
// file stays valid UTF-8 between the arguments. In Lua, string positions
// count bytes, and UTF-8 continuation bytes are 0x80 to 0xBF.
function chunkEnd({ content, offset }: ChunkEndArgs): number {
  let end = offset + PRELOAD_CHUNK_LENGTH;

  if (end >= content.length) {
    return content.length;
  }

  while (end > offset + 1 && isContinuationByte(content.charCodeAt(end))) {
    end -= 1;
  }

  return end;
}

function isContinuationByte(code: number): boolean {
  return code >= 0x80 && code < 0xc0;
}

// Zero-padded so a folder listing sorts batches in order.
function formatBatchNumber({ batchNumber }: { batchNumber: number }): string {
  return String(batchNumber).padStart(8, '0');
}
