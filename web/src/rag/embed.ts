// Local-only embeddings via Ollama, running on the same GPU as the Qwen3
// fallback model. Never sent anywhere — used purely to pick which past
// messages are relevant so we don't ship the whole history to Claude every
// turn. If Ollama isn't running, callers fall back to plain windowing.
const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL ?? "http://localhost:11434";
const EMBED_MODEL = import.meta.env.VITE_EMBED_MODEL ?? "bge-m3";

export async function embed(text: string): Promise<Float32Array | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text.slice(0, 8000) }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: number[] };
    if (!data.embedding) return null;
    return Float32Array.from(data.embedding);
  } catch {
    return null;
  }
}

export function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}
