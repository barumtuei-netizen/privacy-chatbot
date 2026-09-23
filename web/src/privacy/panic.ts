import { destroyDatabase } from "../db/store";
export { createPressCounter } from "./pressCounter";

// Panic wipe: no confirmation on purpose — the whole point is speed when
// someone is about to see the screen. Triggered by pressing Escape three
// times in a row (or tapping the app title three times on a phone).

// Caps how long we wait on IndexedDB so a stuck delete can't keep the
// conversation on screen; the page is replaced either way.
const MAX_WAIT_MS = 800;

export async function panicWipeAndLeave(): Promise<void> {
  try {
    await Promise.race([destroyDatabase(), new Promise<void>((r) => setTimeout(r, MAX_WAIT_MS))]);
  } finally {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // blocked storage — nothing to clear
    }
    // replace(), not assign(): the app must not be reachable via Back. The
    // browser's own history list still holds the URL — that isn't ours to clear.
    window.location.replace("about:blank");
  }
}
