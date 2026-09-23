// Run: node --test src/api/hashKey.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractKeyFromHash } from "./hashKey.ts";

test("plain key is extracted and hash cleared", () => {
  assert.deepEqual(extractKeyFromHash("#key=abc123"), { key: "abc123", remainingHash: "" });
});

test("'+' and '=' in the key survive (URLSearchParams would corrupt '+')", () => {
  assert.equal(extractKeyFromHash("#key=a+b/c=d==").key, "a+b/c=d==");
});

test("percent-escapes are decoded; malformed ones fall back to raw text", () => {
  assert.equal(extractKeyFromHash("#key=a%2Bb%20c").key, "a+b c");
  assert.equal(extractKeyFromHash("#key=100%zz").key, "100%zz");
});

test("other hash params are left alone", () => {
  assert.deepEqual(extractKeyFromHash("#x=1&key=abc&y=2"), { key: "abc", remainingHash: "#x=1&y=2" });
});

test("no key param: nothing changes", () => {
  assert.deepEqual(extractKeyFromHash("#section"), { key: null, remainingHash: "#section" });
  assert.deepEqual(extractKeyFromHash(""), { key: null, remainingHash: "" });
});

test("empty or whitespace key sets nothing but is still removed from the URL", () => {
  assert.deepEqual(extractKeyFromHash("#key="), { key: null, remainingHash: "" });
  assert.deepEqual(extractKeyFromHash("#key=%20%20"), { key: null, remainingHash: "" });
});

test("a param merely starting with 'key' is not the key", () => {
  assert.deepEqual(extractKeyFromHash("#keyboard=1"), { key: null, remainingHash: "#keyboard=1" });
});
