import { useEffect, useRef, useState } from "react";
import { deriveKey, generateSalt } from "../crypto/keyDerivation";
import { decryptText, encryptText } from "../crypto/cipher";
import { getMeta, setMeta, importVault, type VaultExport } from "../db/store";

const VERIFIER_PLAINTEXT = "privacy-chat-verify";
const MIN_PASSPHRASE_LENGTH = 8;

type Props = { onUnlock: (key: CryptoKey) => void | Promise<void>; notice?: string };

export default function PassphraseGate({ onUnlock, notice }: Props) {
  const [mode, setMode] = useState<"checking" | "create" | "unlock">("checking");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMeta().then((meta) => setMode(meta ? "unlock" : "create"));
  }, []);

  // Counterpart to App.tsx's "ส่งออกข้อมูล" — moves a vault between your own
  // devices without any server ever seeing it (everything in the file is
  // still ciphertext). Only offered here on a fresh device with no vault yet.
  async function handleImportFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const data = JSON.parse(await file.text()) as VaultExport;
      await importVault(data);
      setMode("unlock");
      setPassphrase("");
    } catch {
      setError("นำเข้าไฟล์ไม่สำเร็จ ตรวจสอบว่าเป็นไฟล์สำรองที่ถูกต้อง");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      setError(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSPHRASE_LENGTH} ตัวอักษร`);
      return;
    }
    if (passphrase !== confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const salt = generateSalt();
      const key = await deriveKey(passphrase, salt);
      const { iv, ciphertext } = await encryptText(key, VERIFIER_PLAINTEXT);
      await setMeta({ salt, verifierIv: iv, verifierCiphertext: ciphertext });
      // Some mobile browsers (notably iOS Safari under storage pressure or
      // certain privacy settings) can accept an IndexedDB write in-session
      // without it actually surviving a reload. Reading it straight back
      // catches that here instead of silently losing it the next time this
      // device opens the app.
      const written = await getMeta();
      if (!written) {
        throw new Error("storage-verify-failed");
      }
      onUnlock(key);
    } catch (err) {
      console.error("[passphrase] create failed:", err);
      setError(
        "บันทึกรหัสผ่านลงเครื่องไม่สำเร็จ — เบราว์เซอร์นี้อาจบล็อกการเก็บข้อมูล (เช่น โหมดส่วนตัว หรือพื้นที่เก็บข้อมูลเต็ม) ลองเช็คการตั้งค่าเบราว์เซอร์แล้วลองใหม่"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    setBusy(true);
    setError(null);
    try {
      const meta = await getMeta();
      if (!meta) {
        setMode("create");
        return;
      }
      const key = await deriveKey(passphrase, meta.salt);
      const decrypted = await decryptText(key, meta.verifierIv, meta.verifierCiphertext);
      if (decrypted !== VERIFIER_PLAINTEXT) throw new Error("mismatch");
      onUnlock(key);
    } catch {
      setError("รหัสผ่านไม่ถูกต้อง");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || mode === "checking") return;
    if (mode === "create") void handleCreate();
    else void handleUnlock();
  }

  if (mode === "checking") return null;

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

      <form onSubmit={handleSubmit} className="liquid-glass liquid-glass-strong liquid-edge liquid-edge-top" style={styles.card}>
        <div style={styles.title}>
          {mode === "create" ? "ตั้งรหัสผ่านสำหรับเข้ารหัสข้อมูล" : "ใส่รหัสผ่านเพื่อเข้าถึงบทสนทนา"}
        </div>
        <div style={styles.subtitle}>
          {mode === "create"
            ? "รหัสผ่านนี้ใช้เข้ารหัสประวัติแชทบนเครื่องคุณเท่านั้น เราไม่เก็บรหัสผ่านนี้ไว้ที่ไหนเลย ถ้าลืมจะกู้ข้อมูลเก่าคืนไม่ได้"
            : (notice ?? "บทสนทนาเข้ารหัสไว้บนเครื่องนี้ พิมพ์รหัสผ่านเพื่อปลดล็อก")}
        </div>
        <details style={styles.details}>
          <summary style={styles.summary}>เราเข้ารหัสยังไง ทำไมเห็นได้แค่เครื่องคุณ</summary>
          <div style={{ marginTop: 10 }}>ระบบแบ่งการทำงานเป็น 3 ชั้น เพื่อลดจำนวนคนกลางที่เห็นข้อมูลของคุณให้น้อยที่สุด:</div>
          <ul style={styles.list}>
            <li>
              <b>การประมวลผล (Processing):</b> ระบบเชื่อมต่อกับ Claude (Anthropic) และ OpenAI ผ่าน Commercial API โดยตรง ซึ่งตามเงื่อนไขมาตรฐานของทั้งสองเจ้า
              ข้อมูลของคุณจะไม่ถูกนำไปใช้ฝึกโมเดล (Zero Data Training) ต่างจากแอปแชทฟรีทั่วไปที่มักใช้ข้อมูลผู้ใช้พัฒนาโมเดลต่อเป็นค่าเริ่มต้น — ข้อควรรู้: นี่เป็นเงื่อนไขมาตรฐานของผู้ให้บริการ
              ไม่ใช่สัญญาที่เจรจาเฉพาะสำหรับแอปนี้ และ OpenAI ยังคงเก็บ log ตรวจจับการใช้งานผิดปกติ (มีเนื้อหาข้อความอยู่ด้วย) ได้นานถึง 30 วัน
            </li>
            <li>
              <b>การรับ-ส่งข้อมูล (Transmission):</b> เซิร์ฟเวอร์ตัวกลาง (relay) ที่เราเขียนเองทำหน้าที่ส่งผ่านข้อความเท่านั้น ทำงานแบบไร้สถานะและไม่มีการบันทึกล็อก
              (Stateless &amp; Zero-Logging) — ไม่ดักจับ ไม่สร้างแคช ไม่บันทึกสำเนาข้อความไว้ระหว่างทาง
            </li>
            <li>
              <b>การจัดเก็บข้อมูล (Storage):</b> ประวัติการสนทนาทั้งหมดเข้ารหัส AES-256-GCM ด้วยกุญแจที่มาจากรหัสผ่านของคุณผ่าน Argon2id แล้วเก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น
              (Client-side Encryption) เราไม่มีเซิร์ฟเวอร์เก็บสำเนา และถอดรหัสให้ไม่ได้แม้แต่ผู้พัฒนาเอง — ถ้าลืมรหัสผ่าน ก็ไม่มีใครกู้คืนให้ได้เช่นกัน
            </li>
          </ul>
        </details>
        <input
          type="password"
          autoFocus
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="รหัสผ่าน"
          style={styles.input}
        />
        {mode === "create" && (
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="ยืนยันรหัสผ่านอีกครั้ง"
            style={styles.input}
          />
        )}
        {error && <div style={styles.error}>{error}</div>}
        <button type="submit" disabled={busy || !passphrase} style={styles.button}>
          {busy ? "กำลังตรวจสอบ..." : mode === "create" ? "สร้างและเริ่มใช้งาน" : "ปลดล็อก"}
        </button>
        {mode === "create" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              style={styles.linkButton}
            >
              หรือนำเข้าข้อมูลจากไฟล์สำรอง (จากเครื่องอื่น)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleImportFile(file);
              }}
            />
          </>
        )}
      </form>
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
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ffffff",
  fontFamily: "'Manrope', system-ui, -apple-system, sans-serif",
} as React.CSSProperties;

const styles: Record<string, React.CSSProperties> = {
  card: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 32,
    borderRadius: 28,
  },
  title: { fontSize: 20, fontWeight: 600, color: "#27272a", textAlign: "center" },
  subtitle: { fontSize: 13, color: "#6b6b74", lineHeight: 1.6, textAlign: "center" },
  input: {
    position: "relative",
    zIndex: 1,
    border: "1px solid rgba(255,255,255,0.7)",
    background: "rgba(255,255,255,0.55)",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
  },
  details: { position: "relative", zIndex: 1, fontSize: 12.5, color: "#6b6b74", lineHeight: 1.6 },
  summary: { cursor: "pointer", textAlign: "center", color: "#6D5FD3", fontWeight: 600, listStyle: "none" },
  list: { margin: "10px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 },
  error: { fontSize: 13, color: "#dc2626", textAlign: "center" },
  linkButton: {
    position: "relative",
    zIndex: 1,
    border: "none",
    background: "transparent",
    color: "#6b6b74",
    fontSize: 12.5,
    textDecoration: "underline",
    cursor: "pointer",
    padding: "2px 0",
  },
  button: {
    position: "relative",
    zIndex: 1,
    marginTop: 4,
    border: "none",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 15,
    fontWeight: 600,
    color: "#ffffff",
    background: "#6D5FD3",
    boxShadow: "0 10px 24px rgba(109,95,211,0.4), inset 0 1px 1px rgba(255,255,255,0.5)",
    cursor: "pointer",
    transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
  },
};
