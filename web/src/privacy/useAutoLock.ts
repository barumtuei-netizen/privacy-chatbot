import { useEffect, useRef } from "react";
import { IDLE_LOCK_MS, shouldLock } from "./idle";

const ACTIVITY_EVENTS = ["keydown", "pointerdown", "pointermove", "wheel", "touchstart", "scroll"] as const;
const CHECK_EVERY_MS = 5000;

/**
 * Calls `onLock` after IDLE_LOCK_MS without input. `busy` (a reply is
 * streaming) counts as activity. Uses wall-clock timestamps, not a countdown
 * timer: timers are throttled in background tabs and stop while the machine
 * sleeps, so the elapsed time is re-checked on every tick, on tab focus, and
 * — crucially — before an input event is allowed to reset the clock. Without
 * that last check, the first mouse move after waking from sleep would refresh
 * the timestamp and the vault would stay open.
 */
export function useAutoLock(enabled: boolean, busy: boolean, onLock: () => void): void {
  const busyRef = useRef(busy);
  const onLockRef = useRef(onLock);

  useEffect(() => {
    busyRef.current = busy;
    onLockRef.current = onLock;
  }, [busy, onLock]);

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    let locked = false;

    const lock = () => {
      if (locked) return;
      locked = true;
      onLockRef.current();
    };

    const check = () => {
      const now = Date.now();
      if (busyRef.current) {
        last = now;
        return;
      }
      if (shouldLock(last, now, IDLE_LOCK_MS, false)) lock();
    };

    const onActivity = () => {
      const now = Date.now();
      if (shouldLock(last, now, IDLE_LOCK_MS, busyRef.current)) {
        lock();
        return;
      }
      last = now;
    };

    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true, capture: true });
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    const id = window.setInterval(check, CHECK_EVERY_MS);

    return () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity, { capture: true });
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.clearInterval(id);
    };
  }, [enabled]);
}
