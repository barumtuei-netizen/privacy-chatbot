import { useCallback, useEffect, useRef, useState } from "react";
import "./styles/aurora.css";
import PassphraseGate from "./components/PassphraseGate";
import SafetyGate from "./components/SafetyGate";
import ChatView from "./components/ChatView";
import InputBar from "./components/InputBar";
import PersonaPanel from "./components/PersonaPanel";
import { encryptText, decryptText } from "./crypto/cipher";
import { createScrubber } from "./privacy/scrub";
import { createPressCounter, panicWipeAndLeave } from "./privacy/panic";
import { useAutoLock } from "./privacy/useAutoLock";
import { addMessage, getAllMessages, getPersonaNote, setPersonaNote, wipeAll } from "./db/store";
import { streamChatReply, windowMessages, getTtsInfo, getModels, type TtsInfo, type ModelNames } from "./api/relayClient";
import { buildContext, indexAll, indexOne, resetIndex } from "./rag/retrieval";
import type { Message } from "./types";

function isPrimaryThread(m: Message): boolean {
  return m.role === "user" || (m.source !== "second" && m.source !== "reaction");
}

// Bump this if the safety notice's wording changes materially enough that
// people who already acknowledged an older version should see it again.
const SAFETY_ACK_KEY = "privacy-chat:safety-ack-v1";

function hasAckedSafety(): boolean {
  try {
    return localStorage.getItem(SAFETY_ACK_KEY) === "1";
  } catch {
    return false;
  }
}

export default function App() {
  const [safetyAcked, setSafetyAcked] = useState(hasAckedSafety);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const [personaNote, setPersonaNoteState] = useState("");
  const [ttsInfo, setTtsInfo] = useState<TtsInfo>({ enabled: false, voice: null });
  const [modelNames, setModelNames] = useState<ModelNames>({ claude: "Claude", second: null });
  const keyRef = useRef<CryptoKey | null>(null);
  const personaNoteRef = useRef("");
  const messagesRef = useRef<Message[]>([]);

  const [autoLocked, setAutoLocked] = useState(false);
  const titlePressRef = useRef(createPressCounter());

  useEffect(() => {
    keyRef.current = cryptoKey;
  }, [cryptoKey]);

  // Panic wipe: Escape x3. Registered at the root so it works on every screen
  // (safety notice, passphrase gate, chat). e.repeat ignored so holding the
  // key down can't trigger it by accident.
  useEffect(() => {
    const press = createPressCounter();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.repeat) return;
      if (press(performance.now())) void panicWipeAndLeave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    personaNoteRef.current = personaNote;
  }, [personaNote]);

  const handleUnlock = useCallback(async (key: CryptoKey) => {
    const stored = await getAllMessages();
    const decrypted = await Promise.all(
      stored.map(async (m): Promise<Message> => ({
        id: m.id,
        role: m.role,
        text: await decryptText(key, m.iv, m.ciphertext),
        ts: m.ts,
        source: m.source,
      }))
    );
    setMessages(decrypted);

    const storedNote = await getPersonaNote();
    if (storedNote) {
      try {
        setPersonaNoteState(await decryptText(key, storedNote.iv, storedNote.ciphertext));
      } catch {
        setPersonaNoteState("");
      }
    }

    setCryptoKey(key);
    void getTtsInfo().then(setTtsInfo);
    void getModels().then(setModelNames);

    // Background-index history for RAG retrieval; never blocks the UI, and
    // silently no-ops if the local Ollama embedding model isn't running. Only
    // the primary (Claude) thread is indexed — the second brain's parallel
    // answers aren't part of Claude's own conversation continuity.
    resetIndex();
    void indexAll(decrypted.filter(isPrimaryThread));
  }, []);

  const handleSavePersona = useCallback(async (text: string) => {
    const key = keyRef.current;
    if (!key) return;
    setPersonaNoteState(text);
    const { iv, ciphertext } = await encryptText(key, text);
    await setPersonaNote({ iv, ciphertext });
  }, []);

  const handleFactoryReset = useCallback(async () => {
    const confirmed = window.confirm("ลบข้อมูลทั้งหมดถาวร (บทสนทนา, ปมในใจ, รหัสผ่าน) กู้คืนไม่ได้ ยืนยันไหม?");
    if (!confirmed) return;
    await wipeAll();
    window.location.reload();
  }, []);

  // Drops everything decrypted from memory and returns to the passphrase
  // screen. Stored data is untouched — it stays encrypted on disk as always.
  // The embedding index is cleared too: its vectors are derived from the text.
  const handleLock = useCallback(() => {
    keyRef.current = null;
    setCryptoKey(null);
    setMessages([]);
    setPersonaNoteState("");
    setPersonaOpen(false);
    resetIndex();
    setAutoLocked(true);
  }, []);

  useAutoLock(cryptoKey !== null, isTyping, handleLock);

  const handleSend = useCallback(async (text: string) => {
    const key = keyRef.current;
    if (!key) return;

    const userMessage: Message = { role: "user", text, ts: Date.now() };
    const { iv, ciphertext } = await encryptText(key, text);
    await addMessage({ role: "user", iv, ciphertext, ts: userMessage.ts });

    const history = [...messagesRef.current, userMessage];
    setMessages(history);
    setIsTyping(true);
    void indexOne(userMessage);

    const context = await buildContext(history.filter(isPrimaryThread), text);
    // Emails, phone numbers, ID/card numbers and links are swapped for
    // placeholders before leaving the device and swapped back in the reply.
    // Silent by design — no UI, no settings.
    const scrubber = createScrubber([]);
    const outgoing = windowMessages(context).map((m) => ({ role: m.role, content: scrubber.scrub(m.content) }));
    const outgoingNote = scrubber.scrub(personaNoteRef.current);
    const mainRestorer = scrubber.createStreamRestorer();
    const secondRestorer = scrubber.createStreamRestorer();
    const reactionRestorer = scrubber.createStreamRestorer();

    const assistantTs = Date.now();
    const secondTs = assistantTs + 1;
    const reactionTs = assistantTs + 2;
    const genStart = performance.now();
    let assistantText = "";
    let secondText = "";
    let reactionText = "";
    let assistantUsage: Message["usage"];
    let secondUsage: Message["usage"];
    let reactionUsage: Message["usage"];
    let assistantMs: number | undefined;
    let secondMs: number | undefined;
    let reactionMs: number | undefined;

    // Streams can deliver dozens of chunks per second, and with brains
    // streaming at once that's a full message-list re-render per chunk.
    // Coalescing to one state update per animation frame per stream keeps
    // the UI smooth without changing what ends up on screen.
    let assistantFrame: number | null = null;
    let secondFrame: number | null = null;
    let reactionFrame: number | null = null;

    function flushAssistant() {
      assistantFrame = null;
      setMessages((prev) => {
        const withoutDraft = prev.filter((m) => m.ts !== assistantTs);
        return [...withoutDraft, { role: "assistant", text: assistantText, ts: assistantTs, source: "claude", usage: assistantUsage, generationMs: assistantMs }];
      });
    }
    function flushSecond() {
      secondFrame = null;
      setMessages((prev) => {
        const withoutDraft = prev.filter((m) => m.ts !== secondTs);
        return [...withoutDraft, { role: "assistant", text: secondText, ts: secondTs, source: "second", usage: secondUsage, generationMs: secondMs }];
      });
    }
    function flushReaction() {
      reactionFrame = null;
      setMessages((prev) => {
        const withoutDraft = prev.filter((m) => m.ts !== reactionTs);
        return [...withoutDraft, { role: "assistant", text: reactionText, ts: reactionTs, source: "reaction", usage: reactionUsage, generationMs: reactionMs }];
      });
    }

    try {
      await streamChatReply(
        outgoing,
        (chunk) => {
          assistantText += mainRestorer.push(chunk);
          if (assistantFrame === null) assistantFrame = requestAnimationFrame(flushAssistant);
        },
        {
          onSecondChunk: (chunk) => {
            secondText += secondRestorer.push(chunk);
            if (secondFrame === null) secondFrame = requestAnimationFrame(flushSecond);
          },
          onReactionChunk: (chunk) => {
            reactionText += reactionRestorer.push(chunk);
            if (reactionFrame === null) reactionFrame = requestAnimationFrame(flushReaction);
          },
          onUsage: (source, usage) => {
            const ms = Math.round(performance.now() - genStart);
            if (source === "claude") {
              assistantUsage = usage;
              assistantMs = ms;
            } else if (source === "second") {
              secondUsage = usage;
              secondMs = ms;
            } else {
              reactionUsage = usage;
              reactionMs = ms;
            }
          },
          personaNote: outgoingNote,
        }
      );
      assistantText += mainRestorer.flush();
      secondText += secondRestorer.flush();
      reactionText += reactionRestorer.flush();
      flushAssistant();
      flushSecond();
      // Adaptive thinking can occasionally consume its whole token budget on
      // internal reasoning for a sensitive reaction turn, leaving zero
      // visible text (same failure mode as the second brain going silent).
      // The reaction round is a bonus layer, not critical — on empty output,
      // skip it silently instead of showing a blank bubble during what may
      // already be a heavy conversation.
      if (reactionText) flushReaction();

      if (assistantText) {
        const { iv: aIv, ciphertext: aCiphertext } = await encryptText(key, assistantText);
        await addMessage({ role: "assistant", iv: aIv, ciphertext: aCiphertext, ts: assistantTs, source: "claude" });
        void indexOne({ role: "assistant", text: assistantText, ts: assistantTs });
      }
      if (secondText) {
        const { iv: sIv, ciphertext: sCiphertext } = await encryptText(key, secondText);
        await addMessage({ role: "assistant", iv: sIv, ciphertext: sCiphertext, ts: secondTs, source: "second" });
      }
      if (reactionText) {
        const { iv: rIv, ciphertext: rCiphertext } = await encryptText(key, reactionText);
        await addMessage({ role: "assistant", iv: rIv, ciphertext: rCiphertext, ts: reactionTs, source: "reaction" });
      }
    } catch {
      const fallback = "ขอโทษด้วย ตอนนี้เชื่อมต่อกับ Claude ไม่ได้ ลองใหม่อีกครั้งนะ";
      setMessages((prev) => [...prev.filter((m) => m.ts !== assistantTs), { role: "assistant", text: fallback, ts: assistantTs, source: "claude" }]);
    } finally {
      setIsTyping(false);
    }
  }, []);

  if (!safetyAcked) {
    return (
      <SafetyGate
        onAccept={() => {
          try {
            localStorage.setItem(SAFETY_ACK_KEY, "1");
          } catch {
            // Private/blocked storage — the ack just won't persist across
            // reloads, which is a minor annoyance, not a safety gap (the
            // notice would simply show again next time).
          }
          setSafetyAcked(true);
        }}
      />
    );
  }

  if (!cryptoKey) {
    return (
      <PassphraseGate
        onUnlock={(key) => {
          setAutoLocked(false);
          return handleUnlock(key);
        }}
        notice={autoLocked ? "ล็อกให้อัตโนมัติเพราะไม่ได้ใช้งานสักพัก พิมพ์รหัสผ่านเพื่อกลับเข้ามา" : undefined}
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      <div
        className="liquid-edge liquid-edge-bottom"
        style={{
          flex: "0 0 auto",
          padding: "22px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Triple-tap = panic wipe, the phone counterpart of Escape x3. */}
        <div
          onClick={() => {
            if (titlePressRef.current(performance.now())) void panicWipeAndLeave();
          }}
          style={{ fontSize: 13, fontWeight: 600, color: "#71717a", letterSpacing: "0.04em", textTransform: "uppercase", userSelect: "none" }}
        >
          Privacy Chat
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setPersonaOpen(true)} style={headerBtnStyle()}>
            ปมในใจ
          </button>
          <button onClick={handleFactoryReset} style={dangerBtnStyle}>
            รีเซ็ตเป็นค่าโรงงาน
          </button>
        </div>
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <ChatView messages={messages} isTyping={isTyping} ttsInfo={ttsInfo} modelNames={modelNames} />
      </div>

      <InputBar onSend={handleSend} disabled={isTyping} />

      {personaOpen && (
        <PersonaPanel
          initialText={personaNote}
          onSave={handleSavePersona}
          onClose={() => setPersonaOpen(false)}
        />
      )}
    </div>
  );
}

function headerBtnStyle(): React.CSSProperties {
  return {
    padding: "7px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.6)",
    background: "rgba(255,255,255,0.45)",
    backdropFilter: "blur(20px) saturate(200%)",
    WebkitBackdropFilter: "blur(20px) saturate(200%)",
    color: "#71717a",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

const dangerBtnStyle: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 16,
  border: "1px solid #f2c2c2",
  background: "rgba(255,255,255,0.45)",
  backdropFilter: "blur(20px) saturate(200%)",
  WebkitBackdropFilter: "blur(20px) saturate(200%)",
  color: "#c0392b",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
