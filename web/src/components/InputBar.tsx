import { useState, type KeyboardEvent } from "react";

const ACCENT = "#6D5FD3";

type Props = { onSend: (text: string) => void; disabled: boolean };

export default function InputBar({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const canSend = value.trim().length > 0 && !disabled;

  function submit() {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div
      className="liquid-edge liquid-edge-top"
      style={{
        flex: "0 0 auto",
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "18px 40px 16px",
          gap: 8,
        }}
      >
        <div style={{ position: "relative", width: "100%", maxWidth: 680 }}>
          <div className="glow glow-composer" aria-hidden="true" />
        <div
          className="input-pill liquid-glass"
          style={
            {
              "--accent": ACCENT,
              width: "100%",
              maxWidth: 680,
              borderRadius: 30,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 6px 6px 22px",
              background: "#ffffff",
              position: "relative",
              zIndex: 1,
            } as React.CSSProperties
          }
        >
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="พิมพ์ข้อความของคุณ..."
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "inherit",
              fontSize: 16,
              color: "#27272a",
              padding: "10px 0",
              position: "relative",
              zIndex: 1,
            }}
          />
          <button
            className="send-btn"
            onClick={submit}
            disabled={!canSend}
            aria-label="ส่งข้อความ"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: canSend ? ACCENT : "#E4E4E7",
              boxShadow: canSend ? "0 6px 16px rgba(109,95,211,0.45), inset 0 1px 1px rgba(255,255,255,0.6)" : "none",
              position: "relative",
              zIndex: 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={canSend ? "#FFFFFF" : "#A1A1AA"} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </button>
        </div>
        </div>
        <div style={{ fontSize: 12, color: "#5f5f69", textAlign: "center", maxWidth: 480, lineHeight: 1.5 }}>
          บทสนทนานี้เข้ารหัสบนเครื่องของคุณ และไม่ถูกนำไปฝึกโมเดล
          <br />
          หากอยู่ในอันตรายเฉียบพลัน โทร 1669 · สายด่วนสุขภาพจิต โทร 1323 (24 ชม.)
          <br />
          ต้องซ่อนหน้าจอด่วน? กด Esc 3 ครั้ง (หรือแตะชื่อแอปด้านบน 3 ครั้ง) ลบทุกอย่างทันที
        </div>
      </div>
    </div>
  );
}
