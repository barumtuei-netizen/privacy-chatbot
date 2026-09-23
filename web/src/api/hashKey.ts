// Pure parsing for the `#key=...` link, kept free of DOM/storage imports so it
// can be unit-tested directly.
//
// Deliberately not URLSearchParams: it turns "+" into a space, which would
// silently corrupt any access key containing "+" (and then every request
// would 401 with no hint why). Only encodeURIComponent-style %XX is decoded.

export type HashKeyResult = {
  /** Non-empty key found in the hash, or null. */
  key: string | null;
  /** The hash to leave in the address bar ("" or "#other=1"), with `key` removed. */
  remainingHash: string;
};

export function extractKeyFromHash(hash: string): HashKeyResult {
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!body) return { key: null, remainingHash: hash };

  let key: string | null = null;
  let found = false;
  const rest: string[] = [];
  for (const part of body.split("&")) {
    if (part.startsWith("key=")) {
      found = true;
      let value = part.slice("key=".length);
      try {
        value = decodeURIComponent(value);
      } catch {
        // malformed escape — use the raw text rather than dropping the key
      }
      value = value.trim();
      if (value) key = value;
    } else if (part) {
      rest.push(part);
    }
  }
  if (!found) return { key: null, remainingHash: hash };
  return { key, remainingHash: rest.length ? `#${rest.join("&")}` : "" };
}
