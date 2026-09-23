// Run: node --test src/privacy/panic.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPressCounter } from "./pressCounter.ts";

test("fires on the 3rd press inside the window", () => {
  const press = createPressCounter(3, 1200);
  assert.equal(press(0), false);
  assert.equal(press(400), false);
  assert.equal(press(800), true);
});

test("slow presses never trigger", () => {
  const press = createPressCounter(3, 1200);
  for (let t = 0; t < 10000; t += 700) assert.equal(press(t), false);
});

test("resets after firing, so it needs three fresh presses again", () => {
  const press = createPressCounter(3, 1200);
  press(0);
  press(100);
  assert.equal(press(200), true);
  assert.equal(press(300), false);
  assert.equal(press(400), false);
  assert.equal(press(500), true);
});

test("old presses fall out of the window", () => {
  const press = createPressCounter(3, 1200);
  press(0);
  press(1000);
  assert.equal(press(2100), false); // press at 0 expired, only 1000 & 2100 count
  assert.equal(press(2200), true);
});
