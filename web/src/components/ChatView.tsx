import { useEffect, useRef, useState } from "react";
import type { Message } from "../types";
import type { TtsInfo, ModelNames } from "../api/relayClient";
import MessageBubble from "./MessageBubble";

type Props = {
  messages: Message[];
  isTyping: boolean;
  ttsInfo: TtsInfo;
  modelNames: ModelNames;
};

function ThinkingIndicator() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4 }} role="status" aria-live="polite">
      <div className="liquid-typing">
        <span className="typedot" />
        <span className="typedot" style={{ animationDelay: "0.18s" }} />
        <span className="typedot" style={{ animationDelay: "0.36s" }} />
      </div>
      <span style={{ fontSize: 13, color: "#6b6b74" }}>
        กำลังคิดคำตอบ{seconds >= 3 ? ` · ${seconds} วินาที` : "..."}
      </span>
    </div>
  );
}

export default function ChatView({ messages, isTyping, ttsInfo, modelNames }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  if (messages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 24px",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 27, fontWeight: 600, color: "#27272a", letterSpacing: "-0.01em" }}>
          สวัสดี มีอะไรอยากเล่าไหม
        </div>
        <div style={{ fontSize: 15, color: "#6b6b74", maxWidth: 420, lineHeight: 1.65 }}>
          พิมพ์ได้เลย บทสนทนานี้เก็บเข้ารหัสไว้ในเครื่องของคุณเท่านั้น
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, display: "flex", overflow: "hidden" }}>
      <div
        ref={listRef}
        className="scrollarea"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          padding: "28px 15% 32px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {messages.map((m) => (
          <MessageBubble key={m.id ?? m.ts} message={m} ttsInfo={ttsInfo} modelNames={modelNames} />
        ))}
        {isTyping && <ThinkingIndicator />}
      </div>
    </div>
  );
}
