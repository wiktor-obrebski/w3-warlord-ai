import { isErrorLike, serializeError } from '../json/err-serializer';
import { formatJsonNumber, serializeJson } from '../json/json';
import type { JsonTextCache } from '../json/json-text-cache';

export { appendCapturedFields, captureFields, type CapturedFields };

/**
 * Fields as they were when logged, flattened to `[key, value, key, value,
 * ...]`. Strings, numbers and booleans are kept as they are, since they
 * cannot change and are cheap to keep; anything else is serialized at once,
 * as it could be mutated before the record is written.
 */
type CapturedFields = (string | number | boolean | JsonFragment)[];

// Hot-path helpers take positional parameters: an argument object would
// allocate a Lua table on every log call.

/**
 * Appends the enumerable fields of `source` to `fields` from `count` on and
 * returns the new count. Fields that `JSON.stringify` would skip are skipped.
 * `err` holding an error is serialized like Pino's `err` serializer does.
 */
function captureFields(
  source: object,
  fields: CapturedFields,
  count: number
): number {
  for (const key in source) {
    const fieldValue = (source as Record<string, unknown>)[key];
    const fieldType = typeof fieldValue;

    if (
      fieldType === 'string' ||
      fieldType === 'number' ||
      fieldType === 'boolean'
    ) {
      fields[count] = key;
      fields[count + 1] = fieldValue as string | number | boolean;
      count += 2;
    } else if (
      fieldType !== 'undefined' &&
      fieldType !== 'function' &&
      fieldType !== 'symbol'
    ) {
      fields[count] = key;
      fields[count + 1] = captureValue(key, fieldValue);
      count += 2;
    }
  }

  return count;
}

/**
 * Appends `,"key":value` for each captured field. Pushes one part at a
 * time: TSTL turns a push of several into a call allocating a table.
 */
function appendCapturedFields(
  parts: string[],
  fields: CapturedFields,
  textCache: JsonTextCache
) {
  const count = fields.length;

  for (let index = 0; index < count; index += 2) {
    const fieldValue = fields[index + 1];

    parts.push(textCache.memberStart(fields[index] as string));

    switch (typeof fieldValue) {
      case 'string':
        parts.push(textCache.quoted(fieldValue));
        break;
      case 'number':
        parts.push(formatJsonNumber(fieldValue));
        break;
      case 'boolean':
        parts.push(fieldValue ? 'true' : 'false');
        break;
      default:
        parts.push((fieldValue as JsonFragment).json);
    }
  }
}

interface JsonFragment {
  readonly json: string;
}

function captureValue(key: string, fieldValue: unknown): JsonFragment {
  try {
    const value =
      key === 'err' && isErrorLike(fieldValue)
        ? serializeError({ error: fieldValue })
        : fieldValue;

    return { json: serializeJson({ value }) };
  } catch (error) {
    // Logging must never interrupt the caller, e.g. on a throwing getter.
    return {
      json: serializeJson({ value: `[Unserializable: ${String(error)}]` }),
    };
  }
}
