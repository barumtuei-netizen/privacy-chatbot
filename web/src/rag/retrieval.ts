import type { Memory, Message } from "../types";
import { embed, cosineSim } from "./embed";
import type { ChatMessage } from "../api/relayClient";

// In-memory only — vectors are derived from decrypted plaintext, so they
// never touch IndexedDB. Rebuilt from the already-decrypted `messages` array
// each time the app unlocks; that's cheap enough for a personal history.
type Indexed = { ts: number; vec: Float32Array };

let cache: Indexed[] = [];
let indexing: Promise<void> | null = null;

// Separate index for the "memory vault" — distinct from chat history so a
// memory can be surfaced by topic relevance even from the very first
// message, instead of only kicking in once the conversation is long.
type IndexedMemory = { id: number; text: string; vec: Float32Array };
let memoryCache: IndexedMemory[] = [];

export function resetIndex(): void {
  cache = [];
  indexing = null;
  memoryCache = [];
}

export async function indexAllMemories(memories: Memory[]): Promise<void> {
  const known = new Set(memoryCache.map((m) => m.id));
  const todo = memories.filter((m) => m.id !== undefined && !known.has(m.id));
  for (const m of todo) {
    const vec = await embed(m.text);
    if (vec) memoryCache.push({ id: m.id!, text: m.text, vec });
  }
}

export async function indexOneMemory(memory: Memory): Promise<void> {
  if (memory.id === undefined) return;
  const vec = await embed(memory.text);
  if (vec) memoryCache.push({ id: memory.id, text: memory.text, vec });
}

export function removeMemoryFromIndex(id: number): void {
  memoryCache = memoryCache.filter((m) => m.id !== id);
}

const MEMORY_TOP_K = 4;
const MEMORY_MIN_SCORE = 0.3;

/** Relevant memory-vault entries for this turn, most relevant first. */
export async function retrieveMemories(queryText: string): Promise<string[]> {
  if (memoryCache.length === 0) return [];
  const queryVec = await embed(queryText);
  if (!queryVec) return [];

  return memoryCache
    .map((m) => ({ text: m.text, score: cosineSim(queryVec, m.vec) }))
    .filter((m) => m.score >= MEMORY_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MEMORY_TOP_K)
    .map((m) => m.text);
}

export async function indexAll(messages: Message[]): Promise<void> {
  indexing = (async () => {
    const known = new Set(cache.map((c) => c.ts));
    const todo = messages.filter((m) => !known.has(m.ts));
    for (const m of todo) {
      const vec = await embed(m.text);
      if (vec) cache.push({ ts: m.ts, vec });
    }
  })();
  await indexing;
}

export async function indexOne(message: Message): Promise<void> {
  const vec = await embed(message.text);
  if (vec) cache.push({ ts: message.ts, vec });
}

const RECENT_KEEP = 8;
const TOP_K = 12;
const RETRIEVAL_THRESHOLD = RECENT_KEEP + TOP_K;

/**
 * Builds the context to send to Claude. Below the threshold, sends full
 * (windowed) history as before. Above it, sends the most recent turns plus
 * the top-K semantically similar older messages, so tokens don't balloon as
 * the conversation grows — falls back to a plain recency window whenever
 * local embeddings aren't available (e.g. Ollama not running).
 */
export async function buildContext(messages: Message[], queryText: string): Promise<ChatMessage[]> {
  if (messages.length <= RETRIEVAL_THRESHOLD || cache.length === 0) {
    return messages.map((m) => ({ role: m.role, content: m.text }));
  }

  const queryVec = await embed(queryText);
  if (!queryVec) {
    return messages.map((m) => ({ role: m.role, content: m.text }));
  }

  const recent = messages.slice(-RECENT_KEEP);
  const recentTs = new Set(recent.map((m) => m.ts));
  const older = messages.filter((m) => !recentTs.has(m.ts));

  const byTs = new Map(older.map((m) => [m.ts, m]));
  const scored = cache
    .filter((c) => byTs.has(c.ts))
    .map((c) => ({ ts: c.ts, score: cosineSim(queryVec, c.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .sort((a, b) => a.ts - b.ts);

  const retrieved = scored.map((s) => byTs.get(s.ts)!);

  return [...retrieved, ...recent].map((m) => ({ role: m.role, content: m.text }));
}
