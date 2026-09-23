import { extractKeyFromHash } from "./hashKey";

const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? "http://localhost:8787";
const CONTEXT_WINDOW = 40;

// Only relevant once the relay is hosted somewhere reachable from outside
// localhost and RELAY_ACCESS_KEY is set server-side (see relay/.env.example).
// Deliberately NOT baked in at build time (import.meta.env) — this app is
// meant to be hosted as a public static bundle, and anything in the build
// output is readable by whoever finds the URL. Kept in localStorage instead,
// set once per device by opening the app at `<app-url>/#key=<relay key>`
// (see consumeRelayKeyFromUrl). Empty by default, matching a local-only setup
// where the relay requires no key at all.
const RELAY_KEY_STORAGE = "privacy-chat:relay-key";

export function getRelayKey(): string {
  try {
    return localStorage.getItem(RELAY_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setRelayKey(key: string): void {
  try {
    if (key) localStorage.setItem(RELAY_KEY_STORAGE, key);
    else localStorage.removeItem(RELAY_KEY_STORAGE);
  } catch {
    // Private/blocked storage — the key just won't persist across reloads.
  }
}

/**
 * Picks up `#key=...` from the address bar, stores it, and strips it from the
 * URL so it isn't left sitting in view (or in a screenshot / shared link).
 * The fragment is never sent to any server. Call once, before rendering.
 * Limit: the browser's history and any bookmark made from the original link
 * still contain the full URL — treat the link itself as the secret.
 */
export function consumeRelayKeyFromUrl(): void {
  try {
    const { key, remainingHash } = extractKeyFromHash(window.location.hash);
    if (key === null && remainingHash === window.location.hash) return;
    if (key !== null) setRelayKey(key);
    window.history.replaceState(null, "", window.location.pathname + window.location.search + remainingHash);
  } catch {
    // Blocked history/storage — the app still loads; the key just isn't picked up.
  }
}

function authHeaders(): Record<string, string> {
  const key = getRelayKey();
  return key ? { "x-relay-key": key } : {};
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function windowMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-CONTEXT_WINDOW);
}

export type TokenUsage = { inputTokens: number; outputTokens: number; reasoningTokens?: number };

export type StreamChatOptions = {
  onSecondChunk?: (text: string) => void;
  onReactionChunk?: (text: string) => void;
  onUsage?: (source: "claude" | "second" | "reaction", usage: TokenUsage) => void;
  personaNote?: string;
  memories?: string[];
};

export async function streamChatReply(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  options: StreamChatOptions = {}
): Promise<void> {
  const { onSecondChunk, onReactionChunk, onUsage, personaNote, memories } = options;
  const res = await fetch(`${RELAY_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ messages: windowMessages(messages), personaNote, memories }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`relay request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const line = event.trim();
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice("data: ".length);
      if (payload === "[DONE]") return;

      const parsed = JSON.parse(payload) as {
        channel?: "main" | "second" | "reaction" | "usage";
        text?: string;
        error?: string;
        source?: "claude" | "second" | "reaction";
        usage?: TokenUsage;
      };
      if (parsed.error) throw new Error(parsed.error);

      if (parsed.channel === "usage") {
        if (parsed.source && parsed.usage) onUsage?.(parsed.source, parsed.usage);
        continue;
      }
      if (!parsed.text) continue;

      if (parsed.channel === "second") {
        onSecondChunk?.(parsed.text);
      } else if (parsed.channel === "reaction") {
        onReactionChunk?.(parsed.text);
      } else {
        onChunk(parsed.text);
      }
    }
  }
}

export type TtsInfo = { enabled: boolean; voice: string | null };

export async function getTtsInfo(): Promise<TtsInfo> {
  try {
    const res = await fetch(`${RELAY_URL}/api/tts/status`, { headers: authHeaders() });
    if (!res.ok) return { enabled: false, voice: null };
    const data = (await res.json()) as { enabled?: boolean; voice?: string | null };
    return { enabled: Boolean(data.enabled), voice: data.voice ?? null };
  } catch {
    return { enabled: false, voice: null };
  }
}

export type ModelNames = { claude: string; second: string | null };

export async function getModels(): Promise<ModelNames> {
  try {
    const res = await fetch(`${RELAY_URL}/api/models`, { headers: authHeaders() });
    if (!res.ok) return { claude: "Claude", second: null };
    const data = (await res.json()) as { claude?: string; second?: string | null };
    return { claude: data.claude ?? "Claude", second: data.second ?? null };
  } catch {
    return { claude: "Claude", second: null };
  }
}

export async function synthesizeSpeech(text: string): Promise<Blob> {
  const res = await fetch(`${RELAY_URL}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`tts request failed: ${res.status}`);
  }
  return res.blob();
}
