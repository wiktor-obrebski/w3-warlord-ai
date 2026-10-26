import { serializeError } from './err-serializer';

export { escapeJsonString, formatJsonNumber, serializeJson };

/**
 * Serializes any value to JSON, like Pino's safe stringify: `Error`
 * instances use the `err` serializer's form, circular references become
 * `"[Circular]"`, values nested deeper than 5 levels become `"[Object]"` or
 * `"[Array]"`, and only the first 100 entries of an object or array are
 * written.
 *
 * Under TSTL, `null` is `nil`, so `null` properties disappear, and an empty
 * table is written as `[]`.
 */
function serializeJson({ value }: { value: unknown }): string {
  const parts: string[] = [];

  appendJsonValue(parts, value, []);

  return parts.join('');
}

// Hot-path helpers run for every value logged. They take positional
// parameters, since an argument object would allocate a Lua table per
// value, and push one part at a time, since TSTL turns a push of several
// into a call allocating a table.

/** Escapes a string for use between JSON quotes. */
function escapeJsonString(text: string): string {
  const length = text.length;
  let escaped: string[] | undefined;
  let unescapedFrom = 0;

  for (let index = 0; index < length; index++) {
    const code = text.charCodeAt(index);

    if (code >= 0x20 && code !== Quote && code !== Backslash) {
      continue;
    }

    escaped ??= [];
    escaped.push(text.substring(unescapedFrom, index));
    escaped.push(escapeCharacter(code));
    unescapedFrom = index + 1;
  }

  if (escaped === undefined) {
    return text;
  }

  escaped.push(text.substring(unescapedFrom));
  return escaped.join('');
}

/** Formats a number as JSON; like `JSON.stringify`, non-finite numbers become `null`. */
function formatJsonNumber(value: number): string {
  if (value !== value || value === Infinity || value === -Infinity) {
    return 'null';
  }

  return String(value);
}

const MaxDepth = 5;
const MaxBreadth = 100;
const Quote = 0x22;
const Backslash = 0x5c;

function appendJsonValue(parts: string[], value: unknown, ancestors: object[]) {
  switch (typeof value) {
    case 'string':
      parts.push('"');
      parts.push(escapeJsonString(value));
      parts.push('"');
      return;
    case 'number':
      parts.push(formatJsonNumber(value));
      return;
    case 'boolean':
      parts.push(value ? 'true' : 'false');
      return;
    case 'object':
      if (value === null) {
        parts.push('null');
      } else {
        appendJsonObject(parts, value, ancestors);
      }
      return;
    case 'undefined':
    case 'function':
    case 'symbol':
      parts.push('null');
      return;
    default:
      // Bigints, and Lua userdata such as Warcraft handles.
      parts.push('"');
      parts.push(escapeJsonString(String(value)));
      parts.push('"');
  }
}

function appendJsonObject(parts: string[], value: object, ancestors: object[]) {
  if (ancestors.includes(value)) {
    parts.push('"[Circular]"');
    return;
  }

  const isArray = Array.isArray(value);

  if (ancestors.length >= MaxDepth) {
    parts.push(isArray ? '"[Array]"' : '"[Object]"');
    return;
  }

  ancestors.push(value);

  if (isArray) {
    appendJsonArray(parts, value as unknown[], ancestors);
  } else {
    const properties =
      value instanceof Error ? serializeError({ error: value }) : value;

    appendJsonProperties(
      parts,
      properties as Record<string, unknown>,
      ancestors
    );
  }

  ancestors.pop();
}

function appendJsonArray(
  parts: string[],
  elements: unknown[],
  ancestors: object[]
) {
  const written = Math.min(elements.length, MaxBreadth);

  parts.push('[');
  for (let index = 0; index < written; index++) {
    if (index > 0) {
      parts.push(',');
    }
    appendJsonValue(parts, elements[index], ancestors);
  }

  const omitted = elements.length - written;
  if (omitted > 0) {
    parts.push(`,"... ${omitted} more items"`);
  }
  parts.push(']');
}

function appendJsonProperties(
  parts: string[],
  properties: Record<string, unknown>,
  ancestors: object[]
) {
  let written = 0;
  let omitted = 0;

  parts.push('{');
  for (const key in properties) {
    const propertyValue = properties[key];
    const propertyType = typeof propertyValue;

    if (
      propertyType === 'undefined' ||
      propertyType === 'function' ||
      propertyType === 'symbol'
    ) {
      continue;
    }

    if (written === MaxBreadth) {
      omitted += 1;
      continue;
    }

    parts.push(written > 0 ? ',"' : '"');
    // Lua tables may have number keys.
    parts.push(escapeJsonString(String(key)));
    parts.push('":');
    appendJsonValue(parts, propertyValue, ancestors);
    written += 1;
  }

  if (omitted > 0) {
    parts.push(`${written > 0 ? ',' : ''}"...":"${omitted} more items"`);
  }
  parts.push('}');
}

const ShortEscapes: Readonly<Record<number, string>> = {
  [0x08]: '\\b',
  [0x09]: '\\t',
  [0x0a]: '\\n',
  [0x0c]: '\\f',
  [0x0d]: '\\r',
  [Quote]: '\\"',
  [Backslash]: '\\\\',
};

const HexDigits = '0123456789abcdef';

function escapeCharacter(code: number): string {
  const shortEscape = ShortEscapes[code];

  if (shortEscape !== undefined) {
    return shortEscape;
  }

  return `\\u00${HexDigits.charAt(Math.floor(code / 16))}${HexDigits.charAt(code % 16)}`;
}
