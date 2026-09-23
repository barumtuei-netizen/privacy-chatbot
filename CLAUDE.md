# Privacy-First AI Chatbot

## เป้าหมายโปรเจกต์
เว็บแอป AI chatbot ที่ยึด privacy เป็นหลักการอันดับหนึ่ง สำหรับให้ผู้ใช้พูดคุยเรื่องส่วนตัว/สถานการณ์วิกฤต (เช่น self-harm, ความทุกข์รุนแรง) ได้โดยไม่ต้องกลัวว่าข้อมูลจะถูกเก็บหรือนำไปเทรนโดยไม่จำเป็น ต้องการความฉลาดของ AI สูงสุดเท่าที่จะทำได้โดยไม่แลก privacy โดยไม่จำเป็น

## Hardware
- Local: Notebook GPU, VRAM 8GB — รันโมเดล quantized (Q4) ขนาด 7B-8B ได้สบาย, 14B พอไหวแบบตึงๆ
- เปิดกว้างสำหรับ Cloud GPU เพิ่มเติมถ้าจำเป็น แต่ยังไม่ได้กำหนดขอบเขต

## Architecture ที่ตัดสินใจแล้ว (Hybrid: local-first, cloud-by-consent, zero-server-storage)

**หลักการ**: ลดจำนวน "คนกลาง" ที่เห็นข้อมูลให้น้อยที่สุด แทนที่จะพยายาม local-only แบบสุดโต่ง (ซึ่งความฉลาดจะไม่พอสำหรับบทสนทนาเชิงลึก/วิกฤต)

**Insight สำคัญ**: consumer chat app (เว็บ/แอปฟรีของ ChatGPT/Gemini) มักเก็บบทสนทนาไปเทรนโดย default แต่ **commercial API** ของผู้ให้บริการรายใหญ่ (รวม Anthropic) โดย default **ไม่นำ input/output ไปเทรนโมเดล** — ดังนั้น "ฉลาดที่สุด" กับ "ไม่ถูกเทรน" ไม่ขัดแย้งกัน ถ้าเรียกผ่าน API แทนที่จะเป็น chat app ปกติ

**สิ่งที่อยู่บนเครื่องผู้ใช้ (Client):**
- ประวัติแชท/ความจำทั้งหมด เก็บ encrypted at rest (เช่น SQLCipher) ด้วย key จาก passphrase ของผู้ใช้เอง
- Local LLM (Ollama/llama.cpp) เป็นโหมดสำรอง/offline/max-privacy — ไม่ใช่ตัวหลัก เพราะความฉลาดไม่พอสำหรับบทสนทนาเชิงลึก
- ผู้ใช้เลือกเองต่อข้อความว่าจะให้ตอบแบบ local หรือส่งไป cloud (เป็น action ที่มองเห็นชัดเจน ไม่ auto-send เงียบๆ)
- ไม่มี login/account ผูกตัวตนจริงถ้าเป็นไปได้ (ลด metadata risk)

**สิ่งที่ไม่ควรมี:**
- ไม่ควรมี backend server ของตัวเองที่ log/เก็บบทสนทนา — ถ้าจำเป็นต้องมี relay (เพื่อซ่อน API key) ต้องเป็น stateless, ไม่ log อะไรเลย

**Cloud (opt-in ต่อข้อความ):**
- **Claude API เป็นตัวหลัก** (ยืนยันแล้วโดยผู้ใช้ 2026-09-07) — เหตุผล: data policy ไม่เทรนจาก API data by default, เน้น safety โดยเฉพาะเรื่อง crisis/mental health, เข้ากันได้ดีกับ Claude Code ที่ใช้พัฒนาอยู่
- ส่งเฉพาะ context ที่จำเป็นต่อ turn นั้น (windowed) ไม่ส่งประวัติทั้งหมดทุกครั้งโดยไม่จำเป็น
- ไม่มี logging/analytics SDK ฝั่งเราที่เห็นเนื้อหาข้อความ

## จุดที่ตัดสินใจแล้ว (อัปเดต 2026-09-07)

### 1. Local model สำรอง: **Qwen3 8B (Q4_K_M) ผ่าน Ollama**
รันบน GPU VRAM 8GB ได้ลื่น (~30 tok/s ระดับ 7-8B ที่ Q4) เป็นตัวเลือกที่ดีที่สุดในกลุ่มขนาดนี้สำหรับ reasoning/RAG/agent ใช้เป็นโหมดสำรอง/offline เท่านั้น ไม่ใช่ตัวหลัก

### 2. Encryption ข้อมูลบนเครื่อง: **SQLCipher + key จาก passphrase ผ่าน Argon2id**
- ไม่เก็บ passphrase หรือ key ไว้ที่ไหนเลย ผู้ใช้ต้องพิมพ์ทุกครั้งที่เปิดแอป (max security, เหมาะกับข้อมูล sensitive ระดับนี้)
- ทางเลือกอื่น (เก็บ key ไว้ใน OS keychain เพื่อความสะดวก ไม่ต้องพิมพ์ passphrase ทุกครั้ง) มีความเสี่ยงเพิ่มขึ้นถ้าเครื่อง/บัญชี OS ถูกเข้าถึง — เป็น trade-off เชิงคุณค่าที่ควรให้ผู้ใช้ (เจ้าของโปรเจกต์) ยืนยันเองถ้าต้องการเปลี่ยนจาก default นี้

### 3. Claude API data retention — ตรวจสอบแล้ว (ที่มา: เอกสารทางการของ Anthropic, ดึงข้อมูล 2026-09-07)
- **Sonnet 5 ไม่ใช่ "Covered Model"** (Covered Models = Fable 5/5.1, Mythos 5/5.1 เท่านั้น ซึ่งบังคับเก็บข้อมูล 30 วัน) — เลือก Sonnet 5 เป็นโมเดลหลักของแอปถูกต้องแล้ว ไม่ติดเงื่อนไขบังคับเก็บข้อมูลนี้
- ภายใต้ **Commercial Terms** (API): เนื้อหาการสนทนา (prompt/response) **ไม่ถูกเก็บโดย default** และ "retained data is never used for model training without your express permission" — คำมั่นนี้เป็นเงื่อนไขมาตรฐานของ Commercial API ไม่ใช่แค่ enterprise
- **Zero Data Retention (ZDR) แบบเต็มรูปแบบ ต้องติดต่อฝ่ายขาย Anthropic โดยตรง** ไม่ใช่ toggle ที่ self-serve ได้ในระดับ API key ส่วนบุคคล — สำหรับโปรเจกต์ระดับ personal/indie ตอนนี้ ให้ยึด baseline ตาม Commercial Terms ปกติไปก่อน (ซึ่งแข็งแกร่งกว่า consumer app มากอยู่แล้ว) และพิจารณาขอ ZDR ในอนาคตถ้าโปรเจกต์ขยายเป็นระดับองค์กร
- แหล่งอ้างอิง: [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention), [Data retention practices for Covered Models](https://support.claude.com/en/articles/15425996-data-retention-practices-for-covered-models)

## UX Design (ตัดสินใจแล้ว, อัปเดต 2026-09-07)

### Local/Cloud selection — ตัดทิ้งจาก primary UX
ไม่ทำ UI เลือก local/cloud แบบเด่นชัดต่อข้อความอีกต่อไป — **default ไป cloud (Claude API) เสมอ** เพื่อความฉลาดสูงสุด (เหตุผล: ผู้ใช้คนแรกคือเจ้าของโปรเจกต์เอง ต้องการขายความฉลาดของ AI ให้ได้มากที่สุด และ commercial API data policy ก็ปลอดภัยพอแล้วตามที่ตรวจสอบไว้ด้านบน) Local model (Qwen3 8B) ยังคงมีไว้เป็นโหมดสำรอง/offline แต่ไม่ใช่จุดที่ต้อง design UX ให้เด่นในรอบนี้

### Visual style
แรงบันดาลใจจาก Gemini:
- พื้นหลังหลักสีขาวสะอาด (clean white)
- ส่วนล่างของจอ ~20-40% ของความสูงหน้าจอ เป็นพื้นที่สีพาสเทล มี gradient ไล่สีเคลื่อนไหวช้าๆ ต่อเนื่อง (แนวคิด: โซนนี้เป็นที่อยู่ของ message input / บริเวณ "hero" ที่ให้ความรู้สึกสงบ เหมาะกับ context การคุยเรื่องส่วนตัว/วิกฤต)

## Implementation จริง (อัปเดต 2026-09-08) — MVP v1 เสร็จแล้ว ใช้งานได้จริง

**Stack ที่ใช้จริง** (ต่างจากสมมติฐาน local-first เดิมเล็กน้อย เพราะเป็น web app ธรรมดา ไม่ใช่ Electron/Tauri — ตัดสินใจแล้วว่า SQLCipher ทำไม่ได้ใน browser ล้วน):
- `web/` — Vite + React + TS. Encryption: passphrase → Argon2id (`hash-wasm`) → AES-GCM key (WebCrypto), เก็บ ciphertext ใน IndexedDB (`idb`). Key อยู่ใน memory เท่านั้น ต้องพิมพ์ passphrase ทุกครั้งที่เปิดแอปตามที่ตัดสินใจไว้
- `relay/` — **Cloudflare Worker** (ย้ายจาก Node/Express บน Fly.io เมื่อ 2026-09-21 เพราะ Fly หมด trial), stateless, ไม่ log เนื้อหา (`[observability] enabled = false`), forward ไป Anthropic (`claude-sonnet-5`) และ OpenAI แบบ stream (SSE) ด้วย `fetch` ตรง ไม่ใช้ SDK. dev: `npm run dev` ใน `relay/` (= `wrangler dev --port 8787` อ่านค่าจาก `relay/.env`), typecheck: `npm run typecheck`. โค้ด: `relay/src/worker.ts` + `prompts.ts`; config: `relay/wrangler.toml` (secrets ไม่อยู่ในไฟล์ ตั้งด้วย `wrangler secret put`). Express/Docker/Fly ถูกลบแล้ว (ดู git history ก่อน commit ย้าย)
- BYO API key: ผู้ใช้ (เจ้าของแอป) ใส่ `ANTHROPIC_API_KEY` เองใน `relay/.env` (ไม่ commit, มี `.gitignore`) — ไม่มี backend กลางที่เก็บ key ของคนอื่น
- Local Ollama fallback (Qwen3 8B) — **ยังไม่ทำ** เป็น v2 ตามที่ตกลงไว้ว่า v1 core เท่านั้น
- Custom crisis-detection logic — **ตั้งใจไม่ทำ** พึ่ง built-in safety behavior ของ Claude API ตามเหตุผลที่เลือก Claude ไว้แล้ว

**UI/UX**: ต่อยอดจาก mockup เป็น "liquid glass" theme แบบ Apple แต่หนืด/ยืดเหนียวเกินจริง (ตัดสินใจ 2026-09-08) — บล็อบพื้นหลังใช้ SVG goo filter (ไม่ใช่ CSS blur+contrast ธรรมดา เพราะสีพาสเทลอ่อนจะโดน contrast ฟอกเป็นขาวหมด), glass panel ทุกจุด (bubble, input pill, passphrase card) ใช้ `backdrop-filter: blur(38-56px) saturate(190-220%)`

## สถานะ
- MVP v1 ทำงานจบ end-to-end แล้ว: ตั้ง/ปลดล็อกรหัสผ่าน → เข้ารหัสเก็บประวัติ → คุยกับ Claude จริงผ่าน relay → decrypt คืนได้หลัง reload
- ผ่าน `/security-review` แล้ว 1 รอบ — เจอและแก้แล้ว 1 จุด (relay bind ทุก interface), อีกจุด (ความยาว passphrase ขั้นต่ำ 8) ตัดสินใจแล้วว่าเป็น trade-off ที่ยอมรับได้ ไม่ใช่บัค
- Liquid glass redesign เสร็จแล้ว ทดสอบทั้ง desktop และ mobile viewport แล้ว (เจอ+แก้บั๊ก mobile 1 จุด: บล็อบพื้นหลังหน้า passphrase gate ยืดเต็มจอสูงทำให้มีช่องว่าง — แก้ด้วยการ cap ความสูงไว้ 480px)
- ทุกอย่าง commit ไว้ใน git แล้ว ดู `git log` สำหรับรายละเอียดแต่ละ commit

## อัปเดต 2026-09-21 — สถานะจริงหลัง MVP v1 และงาน privacy-verifiability
**ที่เพิ่มมาแล้วหลัง v1** (ดู `git log`): สมองที่สอง (OpenAI) ตอบคู่ขนาน, TTS (Google), memory vault + RAG (embedding ผ่าน Ollama ในเครื่อง), safety gate, export/import vault, deploy config (Fly.io) — กล้อง/face-tracking ถูกถอดออกแล้ว ข้อความ "ยังไม่ทำ Ollama fallback" ด้านบนยังจริงสำหรับ *LLM* fallback (Ollama ใช้แค่ embedding)

**เพิ่มใน session นี้ (ยังไม่ commit):**
- `web/src/privacy/scrub.ts` — ปกปิดอีเมล/เบอร์/เลขบัตร/ลิงก์บนเครื่องก่อนส่ง แล้วสลับกลับใน reply แบบ stream ทำงานเงียบ ไม่มี UI/ตั้งค่า. มี test: `npm test` ใน `web/`
- `docs/THREAT_MODEL.md` — ใครเห็นอะไร / อะไรไม่ปกป้อง **อ่านก่อนเพิ่มฟีเจอร์ที่ส่งข้อมูลออกนอกเครื่อง**

**ตัดสินใจ 2026-09-21 (เจ้าของโปรเจกต์): ลด UI เรื่อง privacy ลง** — ผู้ใช้ตรวจ privacy เองไม่ได้อยู่แล้ว ปุ่ม/หน้าตั้งค่าเป็นภาระ. ลบปุ่ม "ความเป็นส่วนตัว" (ใบเสร็จ/ตรวจก่อนส่ง/รายการคำปกปิด — ที่เพิ่งทำแล้วถอดทิ้ง), "ส่งออกข้อมูล", "ตั้งค่าเชื่อมต่อ" ออกจาก header. โมเดลขาย: ผู้ใช้จ่ายค่า API tier เสียเงิน (ไม่ขาย privacy เป็นจุดขายหลักที่ต้องพิสูจน์)
- header เหลือ: "ปมในใจ" + "รีเซ็ตเป็นค่าโรงงาน"
- **"ความทรงจำ" ถูกถอด UI และเลิกส่งให้ AI** (ซ้ำซ้อนกับปมในใจ และพึ่ง Ollama ซึ่งลูกค้าทั่วไปไม่มี) — ข้อมูลใน IndexedDB (`memories`) และโค้ด store/retrieval ยังอยู่ ไม่ได้ลบ ถ้าจะเอากลับมาดู git history ของ `MemoriesPanel.tsx`
- `exportVault`/`importVault` ใน store และปุ่ม import ใน `PassphraseGate` ยังอยู่แต่ไม่มีปุ่ม export แล้ว; `setRelayKey` ยังอยู่ใน `relayClient.ts` แต่ไม่มี UI ตั้งค่า (ถ้า host relay พร้อม `RELAY_ACCESS_KEY` ต้องหาทางส่ง key ให้ client)

**TTS (2026-09-21):** เจ้าของโปรเจกต์ตัดสินใจให้ส่งข้อความให้ Google ได้โดยไม่ถามยืนยัน แต่ต้องแจ้งบนปุ่มให้อ่าน ("ข้อความนี้จะถูกส่งให้ Google สร้างเสียง") — ตัดอีเมล/ลิงก์/เบอร์/เลขบัตรเป็นคำกลางก่อนส่ง (`redactForSpeech`) ชื่อคน/สถานที่ยังถูกส่ง

**ดีไซน์ (2026-09-21):** (1) ข้อมูลนักพัฒนาในบับเบิล (ชื่อโมเดล, โทเค็น, เวลา) ซ่อนเป็นค่าเริ่มต้น เปิดด้วย `?dev=1` ใน URL (`?dev=0` ปิด) — `web/src/devMode.ts`; คำตอบหลักไม่มีป้าย, สมองที่สองแสดง "อีกมุมมองหนึ่ง" (2) สีตัวอักษรที่ต่ำกว่า WCAG 4.5:1 แก้แล้วทั้งหมด (footer/สายด่วน, ชื่อแอป, ข้อความ "กำลังคิด", hint ต่างๆ, ปุ่ม TTS, ป้ายสมองที่สอง) — ตอนเพิ่มสีใหม่ให้เช็ค contrast ก่อน

**Deploy:** เว็บ = static build (`VITE_RELAY_URL=<relay url> npm run build` ใน `web/`) ขึ้น host static ใดก็ได้ (เช่น Cloudflare Pages: `wrangler pages deploy dist`). relay = Cloudflare Worker (`wrangler deploy` ใน `relay/`, secrets ตั้งด้วย `wrangler secret put`, เพิ่มโดเมนเว็บใน `RELAY_ALLOWED_ORIGIN` ที่ `wrangler.toml`). ผู้ใช้เปิดเว็บครั้งแรกด้วย `<web-url>/#key=<RELAY_ACCESS_KEY>` เพื่อให้เครื่องนั้นรู้ key. **ข้อจำกัดแผนฟรี Workers:** 100,000 req/วัน, CPU 10 ms/req (เวลารอเครือข่ายไม่นับ); benchmark จำลอง: ตอบ ~1,000 โทเค็น/สมอง ≈ 3.5 ms, ~3,000 ≈ 10 ms (ขอบพอดี) — ถ้าคำตอบยาวมากโดนตัดกลางทาง (error 1102) ให้ลดขนาดคำตอบหรือขึ้น Workers Paid

**ช่องว่างที่ยังเปิดอยู่:** OpenAI ตรวจแล้ว 2026-09-21: ไม่เทรน (จริง) แต่เก็บ log 30 วัน + ข้อยกเว้นให้คนตรวจ ดู THREAT_MODEL (UI ยังไม่บอกเรื่อง 30 วัน), ยังไม่มี duress passphrase

**Panic wipe เสร็จแล้ว (2026-09-21):** Esc x3 ภายใน 1.2 วิ (ทุกหน้า) หรือแตะชื่อแอปที่ header 3 ครั้ง → ลบ IndexedDB + storage ทันทีไม่ถามซ้ำ → `about:blank`. โค้ด: `web/src/privacy/panic.ts`, `pressCounter.ts` (มี test). ข้อจำกัดดู THREAT_MODEL

**Auto-lock เสร็จแล้ว (2026-09-21):** idle 5 นาที (`IDLE_LOCK_MS` ใน `privacy/idle.ts`) → ทิ้ง key/messages/embedding index → หน้า passphrase พร้อมข้อความแจ้ง. ใช้ timestamp ไม่ใช่ countdown (timer โดน throttle/หยุดตอนเครื่องหลับ) และเช็คหมดอายุก่อน activity รีเซ็ตนาฬิกา. ไม่ล็อกตอน stream. Hook: `privacy/useAutoLock.ts`

**Roadmap ต่อ (ตามลำดับที่ตกลงกัน):** เปลี่ยน passphrase (duress passphrase ยังไม่ทำ — แพง เปลี่ยนโครงสร้าง encryption) → CSP เข้ม + test ว่า relay ไม่ log → web search (opt-in ต่อข้อความ, คำค้นผ่าน scrubber + ให้ผู้ใช้ยืนยันก่อน, Brave Search API ผ่าน relay, ปิดอัตโนมัติในโหมดวิกฤต) → Ollama LLM fallback
