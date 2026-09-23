import { memo, useEffect, useRef, useState } from "react";
import type { Message } from "../types";
import type { TtsInfo, ModelNames } from "../api/relayClient";
import Markdown from "./Markdown";
import { synthesizeSpeech } from "../api/relayClient";
import { redactForSpeech } from "../privacy/scrub";
import { DEV_MODE } from "../devMode";

const ACCENT = "#6D5FD3";
// Darkened from the original pastels so the small labels clear 4.5:1 on white.
const SOURCE_COLOR: Record<"claude" | "second" | "reaction", string> = {
  claude: "#6D5FD3",
  second: "#0B6F66",
  reaction: "#8E3FB0",
};
const POP_VARIANTS = ["a", "b", "c", "d"] as const;

function formatTokenCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

type Props = { message: Message; ttsInfo: TtsInfo; modelNames: ModelNames };

function MessageBubble({ message, ttsInfo, modelNames }: Props) {
  const isUser = message.role === "user";
  const source = message.source ?? "claude";
  // The main (Claude) reply carries no label for ordinary users — it's just
  // "the answer". The second brain's bubble still needs one so the two can be
  // told apart, but in plain words; exact model names are dev-mode only.
  const modelLabel = DEV_MODE
    ? source === "claude"
      ? modelNames.claude
      : source === "reaction"
        ? `${modelNames.claude} · เห็นคำตอบอีกสมองแล้ว`
        : (modelNames.second ?? "second brain")
    : source === "claude"
      ? null
      : source === "reaction"
        ? "ความเห็นเพิ่มเติม"
        : "อีกมุมมองหนึ่ง";
  const [audioState, setAudioState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [popVariant] = useState(() => POP_VARIANTS[Math.floor(Math.random() * POP_VARIANTS.length)]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  async function toggleSpeech() {
    if (audioState === "playing") {
      audioRef.current?.pause();
      setAudioState("idle");
      return;
    }
    if (audioState === "loading") return;

    setAudioState("loading");
    try {
      const blob = await synthesizeSpeech(redactForSpeech(message.text));
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setAudioState("idle");
      audio.onerror = () => setAudioState("error");
      await audio.play();
      setAudioState("playing");
    } catch {
      setAudioState("error");
    }
  }

  return (
    <div
      className="msg-bubble"
      data-role={isUser ? "user" : "assistant"}
      data-pop={popVariant}
      style={{
        maxWidth: "68%",
        alignSelf: isUser ? "flex-end" : "flex-start",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: isUser
          ? `linear-gradient(155deg, color-mix(in srgb, ${ACCENT} 92%, white 8%), color-mix(in srgb, ${ACCENT} 78%, white 0%))`
          : "linear-gradient(155deg, rgba(255,255,255,0.75), rgba(244,244,246,0.55))",
        backdropFilter: "blur(34px) saturate(200%)",
        WebkitBackdropFilter: "blur(34px) saturate(200%)",
        border: isUser ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.7)",
        color: isUser ? "#FFFFFF" : "#27272A",
        padding: "12px 18px",
        borderRadius: 20,
        fontSize: 15,
        lineHeight: 1.6,
        boxShadow: isUser
          ? "0 10px 24px rgba(109,95,211,0.35), inset 0 1px 1px rgba(255,255,255,0.5)"
          : "0 6px 18px rgba(30,20,60,0.08), inset 0 1px 1px rgba(255,255,255,0.9)",
      }}
    >
      {!isUser && modelLabel && (
        <div
          style={
            DEV_MODE
              ? {
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  color: SOURCE_COLOR[source],
                  fontFamily: "'Consolas', 'SFMono-Regular', Menlo, monospace",
                }
              : { fontSize: 12.5, fontWeight: 600, color: SOURCE_COLOR[source] }
          }
        >
          {modelLabel}
        </div>
      )}
      <Markdown text={message.text} />
      {DEV_MODE && !isUser && (message.usage || message.generationMs !== undefined) && (
        <div
          style={{
            fontSize: 10.5,
            color: "#6b6b74",
            fontFamily: "'Consolas', 'SFMono-Regular', Menlo, monospace",
          }}
        >
          {message.usage && (
            <>
              {formatTokenCount(message.usage.inputTokens)} in · {formatTokenCount(message.usage.outputTokens)} out
              {message.usage.reasoningTokens ? ` · ${formatTokenCount(message.usage.reasoningTokens)} reasoning` : ""}
            </>
          )}
          {message.generationMs !== undefined && (
            <> · {(message.generationMs / 1000).toFixed(1)}s</>
          )}
        </div>
      )}
      {!isUser && ttsInfo.enabled && (
        <button
          onClick={toggleSpeech}
          aria-label={audioState === "playing" ? "หยุดอ่านออกเสียง" : "อ่านออกเสียง"}
          style={{
            alignSelf: "flex-start",
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: "none",
            background: "transparent",
            padding: "2px 0",
            cursor: audioState === "loading" ? "default" : "pointer",
            color: audioState === "error" ? "#c0392b" : "#6D5FD3",
            fontSize: 12,
            opacity: 0.85,
          }}
        >
          <SpeakerIcon state={audioState} />
          {audioState === "loading" && "กำลังสร้างเสียง..."}
          {audioState === "playing" && "กำลังอ่าน..."}
          {audioState === "idle" && "อ่านออกเสียง · ข้อความนี้จะถูกส่งให้ Google สร้างเสียง"}
          {audioState === "error" && "เล่นเสียงไม่ได้"}
        </button>
      )}
    </div>
  );
}

export default memo(MessageBubble);

function SpeakerIcon({ state }: { state: "idle" | "loading" | "playing" | "error" }) {
  if (state === "playing") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="6" y="6" width="4" height="12" rx="1" />
        <rect x="14" y="6" width="4" height="12" rx="1" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 9 3 15 8 15 13 20 13 4 8 9 3 9" />
      <path d="M16 8.5a4.5 4.5 0 0 1 0 7" />
    </svg>
  );
}
