import { useState } from "react";

type Props = { onAccept: () => void };

export default function SafetyGate({ onAccept }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <div style={wrapStyle}>
      <div
        className="aurora-wrap"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: "min(100%, 480px)",
          transform: "translateY(-50%)",
          opacity: 0.7,
        }}
      >
        <div className="goo-wrap">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
          <div className="blob blob-4" />
          <div className="blob blob-5" />
        </div>
      </div>

      <div className="liquid-glass liquid-glass-strong liquid-edge liquid-edge-top" style={styles.card}>
        <div style={styles.title}>ก่อนเริ่มใช้งาน</div>

        <div style={styles.body}>
          <p style={styles.p}>
            แอปนี้คือ AI สำหรับพูดคุย <strong>ไม่ใช่นักจิตวิทยา แพทย์ หรือบริการฉุกเฉิน</strong> ไม่มีคนตรวจสอบบทสนทนาแบบเรียลไทม์
            และ AI อาจตอบผิดพลาดได้เสมอ
          </p>
          <div style={styles.hotlineBox}>
            <div style={styles.hotlineTitle}>ถ้าคุณหรือคนใกล้ตัวกำลังอยู่ในอันตรายเฉียบพลันตอนนี้</div>
            <div style={styles.hotlineRow}>
              <strong>1669</strong> — การแพทย์ฉุกเฉิน (24 ชม.)
            </div>
            <div style={styles.hotlineRow}>
              <strong>191</strong> — ตำรวจ
            </div>
            <div style={styles.hotlineRow}>
              <strong>1323</strong> — สายด่วนสุขภาพจิต กรมสุขภาพจิต ฟรี ตลอด 24 ชม. คุยกับคนจริง
            </div>
          </div>
          <p style={styles.p}>
            แอปนี้ไม่สามารถทดแทนการรักษาหรือคำปรึกษาจากผู้เชี่ยวชาญได้ ในสถานการณ์เร่งด่วนหรือรุนแรง ให้ติดต่อเบอร์ข้างต้นหรือคนที่คุณไว้ใจก่อนเสมอ
          </p>
        </div>

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={styles.checkbox}
          />
          <span>ฉันเข้าใจข้อจำกัดข้างต้น และรับทราบว่าแอปนี้ไม่ใช่บริการฉุกเฉินหรือการรักษาทางการแพทย์</span>
        </label>

        <button onClick={onAccept} disabled={!checked} style={buttonStyle(checked)}>
          เข้าใจแล้ว เริ่มใช้งาน
        </button>
      </div>
    </div>
  );
}

const wrapStyle = {
  "--b1": "#E4D9FB",
  "--b2": "#D8E8FB",
  "--b3": "#FBD9EA",
  "--b4": "#D9FBEA",
  width: "100%",
  height: "100%",
  position: "relative",
  overflow: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ffffff",
  fontFamily: "'Manrope', system-ui, -apple-system, sans-serif",
  padding: "24px 0",
} as React.CSSProperties;

const styles: Record<string, React.CSSProperties> = {
  card: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 460,
    margin: "0 20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 28,
    borderRadius: 28,
  },
  title: { fontSize: 19, fontWeight: 600, color: "#27272a", textAlign: "center" },
  body: { display: "flex", flexDirection: "column", gap: 12 },
  p: { fontSize: 13.5, color: "#52525b", lineHeight: 1.7, margin: 0 },
  hotlineBox: {
    background: "rgba(255,255,255,0.6)",
    border: "1px solid rgba(0,0,0,0.06)",
    borderRadius: 16,
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  hotlineTitle: { fontSize: 12.5, fontWeight: 700, color: "#27272a", marginBottom: 2 },
  hotlineRow: { fontSize: 13.5, color: "#3f3f46", lineHeight: 1.5 },
  checkboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    fontSize: 13,
    color: "#52525b",
    lineHeight: 1.6,
    cursor: "pointer",
  },
  checkbox: { marginTop: 3, width: 16, height: 16, flexShrink: 0, cursor: "pointer" },
};

function buttonStyle(enabled: boolean): React.CSSProperties {
  return {
    marginTop: 2,
    border: "none",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 15,
    fontWeight: 600,
    color: "#ffffff",
    background: enabled ? "#6D5FD3" : "#D4D4D8",
    boxShadow: enabled ? "0 10px 24px rgba(109,95,211,0.4), inset 0 1px 1px rgba(255,255,255,0.5)" : "none",
    cursor: enabled ? "pointer" : "not-allowed",
  };
}
