import { useState } from "react";

type Props = {
  initialText: string;
  onSave: (text: string) => void;
  onClose: () => void;
};

export default function PersonaPanel({ initialText, onSave, onClose }: Props) {
  const [text, setText] = useState(initialText);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,18,28,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="liquid-glass liquid-edge liquid-edge-top"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 24,
          padding: 26,
          background: "rgba(255,255,255,0.7)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: "#27272a" }}>ปมในใจ / บริบทส่วนตัว</div>
        <div style={{ fontSize: 13, color: "#6b6b74", lineHeight: 1.6 }}>
          ข้อความนี้จะถูกเข้ารหัสเก็บบนเครื่องเหมือนบทสนทนา และถูกแนบไปกับทุกข้อความที่ส่งให้ Claude
          เป็นบริบทส่วนตัว (ไม่ใช่เปลี่ยนบุคลิก Claude เอง) — ปล่อยว่างได้ถ้าไม่ต้องการใช้
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="เล่าเรื่องราว ปมในใจ สิ่งที่อยากให้ AI เข้าใจเกี่ยวกับคุณ..."
          style={{
            resize: "vertical",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.08)",
            padding: 14,
            fontFamily: "inherit",
            fontSize: 14,
            lineHeight: 1.6,
            background: "rgba(255,255,255,0.6)",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 18px",
              borderRadius: 20,
              border: "none",
              background: "transparent",
              color: "#6b6b74",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ยกเลิก
          </button>
          <button
            onClick={() => {
              onSave(text);
              onClose();
            }}
            style={{
              padding: "9px 22px",
              borderRadius: 20,
              border: "none",
              background: "#6D5FD3",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
