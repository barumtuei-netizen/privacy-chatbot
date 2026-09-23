// Run: node --test src/privacy/idle.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldLock, IDLE_LOCK_MS } from "./idle.ts";

test("does not lock before the limit, locks at and after it", () => {
  assert.equal(shouldLock(0, IDLE_LOCK_MS - 1, IDLE_LOCK_MS, false), false);
  assert.equal(shouldLock(0, IDLE_LOCK_MS, IDLE_LOCK_MS, false), true);
  assert.equal(shouldLock(0, IDLE_LOCK_MS * 50, IDLE_LOCK_MS, false), true);
});

test("never locks while a reply is streaming", () => {
  assert.equal(shouldLock(0, IDLE_LOCK_MS * 10, IDLE_LOCK_MS, true), false);
});
