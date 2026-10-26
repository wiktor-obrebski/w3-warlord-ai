import { escapeJsonString } from './json';

export { createJsonTextCache, type JsonTextCache };

/**
 * Remembers the JSON text of short strings. Log records repeat the same
 * keys, messages and many values, and escaping walks a string character
 * by character, which is slow in Lua. Each cache is cleared when it grows
 * past its limit, so its memory stays bounded.
 */
interface JsonTextCache {
  /** The string as a JSON string, with quotes. */
  quoted(text: string): string;
  /** `,"key":`, introducing a member with this key. */
  memberStart(key: string): string;
}

function createJsonTextCache(): JsonTextCache {
  const quotedTexts = new Map<string, string>();
  const memberStarts = new Map<string, string>();

  return {
    quoted(text) {
      if (text.length > MaxCachedLength) {
        return `"${escapeJsonString(text)}"`;
      }

      let quotedText = quotedTexts.get(text);

      if (quotedText === undefined) {
        if (quotedTexts.size >= MaxEntries) {
          quotedTexts.clear();
        }
        quotedText = `"${escapeJsonString(text)}"`;
        quotedTexts.set(text, quotedText);
      }

      return quotedText;
    },

    memberStart(key) {
      let memberStart = memberStarts.get(key);

      if (memberStart === undefined) {
        if (memberStarts.size >= MaxEntries) {
          memberStarts.clear();
        }
        // Lua tables may have number keys.
        memberStart = `,"${escapeJsonString(String(key))}":`;
        memberStarts.set(key, memberStart);
      }

      return memberStart;
    },
  };
}

const MaxCachedLength = 64;
const MaxEntries = 1024;
