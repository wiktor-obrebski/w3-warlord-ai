import { PRELOAD_BATCH_FORMAT } from '../preload-transport';

export {
  parseBatchFile,
  parseBatchFileName,
  type BatchFileName,
  type ParsedBatchFile,
};

interface BatchFileName {
  session: string;
  batch: number;
}

/** Reads the session and batch number from a batch file's name. */
function parseBatchFileName({
  fileName,
}: {
  fileName: string;
}): BatchFileName | undefined {
  const match = BatchFileNamePattern.exec(fileName);

  if (match === null) {
    return undefined;
  }

  return { session: match[1]!, batch: Number(match[2]) };
}

type ParsedBatchFile =
  | {
      status: 'complete';
      session: string;
      batch: number;
      /** The records' JSON lines, without line breaks. */
      lines: string[];
      /** Lines that are not JSON objects, with their 1-based numbers. */
      invalidLines: { lineNumber: number; line: string }[];
    }
  /** Not fully written yet, e.g. read while the game was writing it. */
  | { status: 'incomplete'; reason: string }
  /** Fully written but unusable. */
  | { status: 'malformed'; reason: string };

/**
 * Reassembles a batch file written by the preload transport: the
 * `Preload` arguments, joined, are a header line and the records' JSON
 * lines. A file is complete once the trailer `PreloadGenEnd` writes after
 * the arguments is present; it is valid when the header's byte and record
 * counts match.
 */
function parseBatchFile({ content }: { content: Buffer }): ParsedBatchFile {
  // Latin-1 maps each byte to one character, so arguments can be cut and
  // joined byte-exactly before the joined records are decoded as UTF-8.
  const text = content.toString('latin1');
  const endIndex = text.lastIndexOf(PreloadEndCall);

  if (endIndex < 0 || !text.trimEnd().endsWith('endfunction')) {
    return { status: 'incomplete', reason: 'the file trailer is missing' };
  }

  const startIndex = text.indexOf(PreloadStartCall);

  if (startIndex < 0) {
    return { status: 'malformed', reason: 'PreloadStart() is missing' };
  }

  const preloadCalls = text
    .slice(startIndex + PreloadStartCall.length, endIndex)
    .trim();

  if (
    !preloadCalls.startsWith(PreloadCallStart) ||
    !preloadCalls.endsWith(PreloadCallEnd)
  ) {
    return { status: 'malformed', reason: 'no Preload calls' };
  }

  const joined = preloadCalls
    .slice(PreloadCallStart.length, -PreloadCallEnd.length)
    .split(PreloadCallSeparator)
    .map((argument) => argument.replaceAll('\\\\', '\\'))
    .join('');

  return parseBatchContent({ joined });
}

const BatchFileNamePattern = /^(.+)-(\d{8,})\.txt$/;
const PreloadStartCall = 'call PreloadStart()';
const PreloadEndCall = 'call PreloadEnd(';
const PreloadCallStart = 'call Preload( "';
const PreloadCallEnd = '" )';
// Batch content never contains a raw tab or carriage return, and a line
// feed in it always follows a `}`, so this cannot match inside an argument.
const PreloadCallSeparator = /" \)\r?\n[ \t]*call Preload\( "/;

interface BatchHeader {
  format: string;
  version: number;
  session: string;
  batch: number;
  records: number;
  bytes: number;
}

function parseBatchContent({ joined }: { joined: string }): ParsedBatchFile {
  const headerEnd = joined.indexOf('\n');
  const header = parseHeader({
    headerLine: headerEnd < 0 ? joined : joined.slice(0, headerEnd),
  });

  if (header === undefined) {
    return { status: 'malformed', reason: 'invalid batch header' };
  }

  const records = joined.slice(headerEnd + 1);

  if (records.length !== header.bytes) {
    return {
      status: 'malformed',
      reason: `${records.length} bytes of records, header says ${header.bytes}`,
    };
  }

  const lines = Buffer.from(records, 'latin1').toString('utf8').split('\n');

  // Each record ends with a line feed, leaving an empty last element.
  lines.pop();

  if (lines.length !== header.records) {
    return {
      status: 'malformed',
      reason: `${lines.length} records, header says ${header.records}`,
    };
  }

  const validLines: string[] = [];
  const invalidLines: { lineNumber: number; line: string }[] = [];

  lines.forEach((line, index) => {
    if (isJsonObject({ text: line })) {
      validLines.push(line);
    } else {
      invalidLines.push({ lineNumber: index + 1, line });
    }
  });

  return {
    status: 'complete',
    session: header.session,
    batch: header.batch,
    lines: validLines,
    invalidLines,
  };
}

function parseHeader({
  headerLine,
}: {
  headerLine: string;
}): BatchHeader | undefined {
  let header: unknown;

  try {
    header = JSON.parse(headerLine);
  } catch {
    return undefined;
  }

  if (typeof header !== 'object' || header === null) {
    return undefined;
  }

  const { format, version, session, batch, records, bytes } = header as Partial<
    Record<keyof BatchHeader, unknown>
  >;

  if (
    format !== PRELOAD_BATCH_FORMAT ||
    version !== 1 ||
    typeof session !== 'string' ||
    !Number.isInteger(batch) ||
    !Number.isInteger(records) ||
    !Number.isInteger(bytes)
  ) {
    return undefined;
  }

  return {
    format,
    version,
    session,
    batch: batch as number,
    records: records as number,
    bytes: bytes as number,
  };
}

function isJsonObject({ text }: { text: string }): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    return (
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    );
  } catch {
    return false;
  }
}
