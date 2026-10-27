import { PRELOAD_BATCH_FORMAT } from './preload-transport';

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

/**
 * Reads the session and batch number from a batch file's name; `undefined`
 * for any other file.
 */
function parseBatchFileName({
  fileName,
}: {
  fileName: string;
}): BatchFileName | undefined {
  if (!fileName.endsWith(BatchFileExtension)) {
    return undefined;
  }

  const name = fileName.slice(0, -BatchFileExtension.length);
  let digitsStart = name.length;

  while (
    digitsStart > 0 &&
    isDigit({ code: name.charCodeAt(digitsStart - 1) })
  ) {
    digitsStart -= 1;
  }

  if (
    name.length - digitsStart < BatchNumberDigits ||
    digitsStart < 2 ||
    name.charAt(digitsStart - 1) !== '-'
  ) {
    return undefined;
  }

  return {
    session: name.slice(0, digitsStart - 1),
    batch: Number(name.slice(digitsStart)),
  };
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
 * Reads the records of a batch file, given its content decoded as UTF-8:
 * the `Preload` arguments, joined, are a header line and the records' JSON
 * lines. A file is complete once the trailer `PreloadGenEnd` writes after
 * the arguments is present; it is valid when the header's byte and record
 * counts match.
 *
 * Runs in Node.js; it relies on `JSON`, which Warcraft's Lua lacks.
 */
function parseBatchFile({ content }: { content: string }): ParsedBatchFile {
  const { body } = withoutTrailer({
    text: content.split('\r\n').join('\n'),
  });

  if (body === undefined) {
    return { status: 'incomplete', reason: 'the file trailer is missing' };
  }

  const startIndex = body.indexOf(PreloadStartCall);

  if (startIndex < 0) {
    return { status: 'malformed', reason: 'PreloadStart() is missing' };
  }

  const { preloadArguments } = splitPreloadCalls({
    preloadCalls: body.slice(startIndex + PreloadStartCall.length).trim(),
  });

  if (preloadArguments === undefined) {
    return { status: 'malformed', reason: 'unexpected Preload calls' };
  }

  return parseBatchContent({
    joined: preloadArguments
      .map((preloadArgument) => preloadArgument.replaceAll('\\\\', '\\'))
      .join(''),
  });
}

const BatchFileExtension = '.txt';
const BatchNumberDigits = 8;
const PreloadStartCall = 'call PreloadStart()';
const PreloadEndCall = 'call PreloadEnd(';
const PreloadCallStart = 'call Preload( "';
const PreloadCallEnd = '" )';

interface BatchHeader {
  format: string;
  version: number;
  session: string;
  batch: number;
  records: number;
  bytes: number;
}

/**
 * The file without the trailer `PreloadGenEnd` writes last, its
 * `call PreloadEnd( ... )` and `endfunction` lines, or `undefined` while
 * the trailer is missing. Taken from the end, since records may contain the
 * same text.
 */
function withoutTrailer({ text }: { text: string }): {
  body: string | undefined;
} {
  const lines = text.trimEnd().split('\n');

  if (lines.pop()?.trim() !== 'endfunction') {
    return { body: undefined };
  }

  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') {
    lines.pop();
  }

  if (!lines.pop()?.trimStart().startsWith(PreloadEndCall)) {
    return { body: undefined };
  }

  return { body: lines.join('\n') };
}

/**
 * The arguments of consecutive `call Preload( "..." )` lines, or
 * `undefined` when they are not such lines. Batch content never contains a
 * raw tab or carriage return, and a line feed in it always follows a `}`,
 * so the end of a call cannot appear inside an argument.
 */
function splitPreloadCalls({ preloadCalls }: { preloadCalls: string }): {
  preloadArguments: string[] | undefined;
} {
  if (!preloadCalls.endsWith(PreloadCallEnd)) {
    return { preloadArguments: undefined };
  }

  const preloadArguments: string[] = [];

  for (const call of preloadCalls
    .slice(0, -PreloadCallEnd.length)
    .split(`${PreloadCallEnd}\n`)) {
    const trimmedCall = call.trimStart();

    if (!trimmedCall.startsWith(PreloadCallStart)) {
      return { preloadArguments: undefined };
    }

    preloadArguments.push(trimmedCall.slice(PreloadCallStart.length));
  }

  return { preloadArguments };
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
  const recordBytes = utf8Length({ text: records });

  if (recordBytes !== header.bytes) {
    return {
      status: 'malformed',
      reason: `${recordBytes} bytes of records, header says ${header.bytes}`,
    };
  }

  const lines = records.split('\n');

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

  for (const [index, line] of lines.entries()) {
    if (isJsonObject({ text: line })) {
      validLines.push(line);
    } else {
      invalidLines.push({ lineNumber: index + 1, line });
    }
  }

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

// The header counts UTF-8 bytes, as Lua strings do; JavaScript strings
// count UTF-16 code units, and a surrogate pair is 4 bytes in UTF-8.
function utf8Length({ text }: { text: string }): number {
  let length = 0;

  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);

    if (code < 0x80) {
      length += 1;
    } else if (code < 0x800 || (code >= 0xd800 && code < 0xe000)) {
      length += 2;
    } else {
      length += 3;
    }
  }

  return length;
}

function isDigit({ code }: { code: number }): boolean {
  return code >= 0x30 && code <= 0x39;
}
