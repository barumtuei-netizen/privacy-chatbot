export const PANIC_PRESSES = 3;
export const PANIC_WINDOW_MS = 1200;

/** Returns a function to call on every press; it answers true on the press that completes the sequence. */
export function createPressCounter(required = PANIC_PRESSES, windowMs = PANIC_WINDOW_MS) {
  let times: number[] = [];
  return (now: number): boolean => {
    times = times.filter((t) => now - t <= windowMs);
    times.push(now);
    if (times.length >= required) {
      times = [];
      return true;
    }
    return false;
  };
}
