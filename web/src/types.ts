export type Message = {
  id?: number;
  role: "user" | "assistant";
  text: string;
  ts: number;
  /** Which brain produced an assistant reply. Undefined = the primary (Claude) thread.
   *  "reaction" = Claude reacting to the second brain's answer (round 2). */
  source?: "claude" | "second" | "reaction";
  /** Token usage + wall-clock time for this reply. Not persisted — lost on reload. */
  usage?: { inputTokens: number; outputTokens: number; reasoningTokens?: number };
  generationMs?: number;
};

export type Memory = {
  id?: number;
  text: string;
  ts: number;
};
