import { useState, type KeyboardEvent } from "react";

const ACCENT = "#6D5FD3";

// A different palette + blob shapes each time the app opens.
const PALETTES = [
  ["#E4D9FB", "#D8E8FB", "#FBD9EA", "#D9FBEA"],
  ["#FFD6E8", "#D6F5FF", "#FFF3B0", "#D6FFE0"],
  ["#C9D6FF", "#FFC9DE", "#C9FFE5", "#FFF0C9"],
  ["#FFADAD", "#FFD6A5", "#CAFFBF", "#A0C4FF"],
  ["#FDE2FF", "#E2FFFB", "#FFF6E2", "#E2E8FF"],
];

function randomPalette(): string[] {
  return PALETTES[Math.floor(Math.random() * PALETTES.length)];
}

function randomShape(): string {
  const a = 40 + Math.random() * 25;
  const b = 100 - a + (Math.random() * 20 - 10);
  const c = 40 + Math.random() * 25;
  const d = 100 - c + (Math.random() * 20 - 10);
  return `${a}% ${100 - a}% ${c}% ${100 - c}% / ${b}% ${d}% ${100 - d}% ${100 - b}%`;
}

type Props = { onSend: (text: string) => void; disabled: boolean };

export default function InputBar({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const [palette] = useState(randomPalette);
  const [shapes] = useState(() => Array.from({ length: 5 }, randomShape));
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
      style={
        {
          flex: "0 0 auto",
          minHeight: 150,
          height: "18%",
          position: "relative",
          overflow: "hidden",
          background: "#FAF9FC",
          "--b1": palette[0],
          "--b2": palette[1],
          "--b3": palette[2],
          "--b4": palette[3],
        } as React.CSSProperties
      }
    >
      <div className="aurora-wrap" style={{ position: "absolute", inset: 0 }}>
        <div className="goo-wrap">
          <div className="blob blob-1" style={{ borderRadius: shapes[0] }} />
          <div className="blob blob-2" style={{ borderRadius: shapes[1] }} />
          <div className="blob blob-3" style={{ borderRadius: shapes[2] }} />
          <div className="blob blob-4" style={{ borderRadius: shapes[3] }} />
          <div className="blob blob-5" style={{ borderRadius: shapes[4] }} />
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 40px",
          gap: 8,
        }}
      >
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
