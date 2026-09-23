// Developer details (model names, token counts, timings) are useful to the
// person building the app and noise to someone using it in a hard moment.
// Off by default. Turn on with `?dev=1` in the URL (remembered on this
// browser); `?dev=0` turns it off again. No UI on purpose.

const DEV_KEY = "privacy-chat:dev";

function read(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("dev");
    if (q === "1") localStorage.setItem(DEV_KEY, "1");
    if (q === "0") localStorage.removeItem(DEV_KEY);
    return localStorage.getItem(DEV_KEY) === "1";
  } catch {
    return false;
  }
}

export const DEV_MODE: boolean = read();
