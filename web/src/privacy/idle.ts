// Pure rule behind auto-lock, kept free of React/DOM so it can be unit-tested.

export const IDLE_LOCK_MS = 5 * 60 * 1000;

/** Lock once the user has been idle for the full limit — never while a reply is still streaming. */
export function shouldLock(lastActivity: number, now: number, limitMs: number, busy: boolean): boolean {
  return !busy && now - lastActivity >= limitMs;
}
