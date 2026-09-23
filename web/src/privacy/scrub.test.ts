// Run: node --test src/privacy/scrub.test.ts   (Node 22.6+ strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createScrubber, totalMasked, redactForSpeech } from "./scrub.ts";

test("masks email, phone (several Thai formats), national ID, card, url", () => {
  const s = createScrubber([]);
  const input =
    "ติดต่อ somchai.j@example.com หรือ 081-234-5678 / 0812345678 / +66 81 234 5678 / 02-123-4567 " +
    "บัตร 1-2345-67890-12-3 การ์ด 4111 1111 1111 1111 ดูที่ https://example.com/a?b=1";
  const out = s.scrub(input);
  assert.ok(!/somchai|081|0812|234-5678|4111|67890|example\.com/.test(out), out);
  const st = s.stats();
  assert.equal(st.EMAIL, 1);
  assert.equal(st.ID, 1);
  assert.equal(st.CARD, 1);
  assert.equal(st.URL, 1);
  assert.equal(st.PHONE, 4); // 081-234-5678 and 0812345678 are different strings
  assert.equal(totalMasked(st), 8);
});

test("national ID is not mistaken for a card, ordinary numbers are left alone", () => {
  const s = createScrubber([]);
  const out = s.scrub("ID 1234567890123 ราคา 10000 บาท ปี 2569 เวลา 14:30");
  assert.equal(s.stats().ID, 1);
  assert.equal(s.stats().CARD, 0);
  assert.ok(out.includes("10000") && out.includes("2569") && out.includes("14:30"), out);
});

test("same value gets the same placeholder; round trip restores it", () => {
  const s = createScrubber([]);
  const out = s.scrub("โทร 0812345678 ซ้ำ 0812345678");
  assert.equal(out, "โทร [PHONE_1] ซ้ำ [PHONE_1]");
  assert.equal(s.restore(out), "โทร 0812345678 ซ้ำ 0812345678");
});

test("user terms: case-insensitive, longest first, thai without spaces", () => {
  const s = createScrubber(["สมชาย", "สมชาย ใจดี", "Bangkok", "x"]);
  const out = s.scrub("พี่สมชาย ใจดี บอกว่า สมชายไปbangkok");
  assert.ok(!out.includes("สมชาย") && !/bangkok/i.test(out), out);
  // "สมชาย ใจดี" (longer) must win over the shorter "สมชาย" at the same spot
  assert.ok(out.startsWith("พี่[PRIVATE_1] บอกว่า [PRIVATE_2]ไป"), out);
  assert.equal(s.stats().PRIVATE, 3);
  assert.equal(s.restore(out), "พี่สมชาย ใจดี บอกว่า สมชายไปbangkok");
});

test("terms with regex metacharacters are treated literally", () => {
  const s = createScrubber(["a.b", "(x)+"]);
  const out = s.scrub("axb a.b (x)+");
  assert.ok(out.startsWith("axb "), out); // "a.b" must not match "axb"
  assert.equal(s.stats().PRIVATE, 2);
});

test("unknown placeholders are left untouched on restore", () => {
  const s = createScrubber([]);
  assert.equal(s.restore("[PHONE_9] และ [ทดสอบ]"), "[PHONE_9] และ [ทดสอบ]");
});

test("stream restorer handles placeholders split across chunks at any point", () => {
  const s = createScrubber(["สมชาย"]);
  s.scrub("สมชาย 0812345678"); // registers [PRIVATE_1], [PHONE_1]
  const reply = "เรื่องของ [PRIVATE_1] ที่โทร [PHONE_1] นะ [ไม่ใช่ตัวแทน] จบ";
  const expected = "เรื่องของ สมชาย ที่โทร 0812345678 นะ [ไม่ใช่ตัวแทน] จบ";
  for (let size = 1; size <= reply.length; size++) {
    const r = s.createStreamRestorer();
    let got = "";
    for (let i = 0; i < reply.length; i += size) got += r.push(reply.slice(i, i + size));
    got += r.flush();
    assert.equal(got, expected, `chunk size ${size}`);
  }
});

test("stream restorer flushes a dangling '[' at the end", () => {
  const s = createScrubber([]);
  const r = s.createStreamRestorer();
  assert.equal(r.push("ราคา [PHO"), "ราคา ");
  assert.equal(r.flush(), "[PHO");
});

test("speech redaction swaps identifiers for spoken words and keeps the rest", () => {
  const out = redactForSpeech("เมล a@b.com โทร 081-234-5678 ดู https://x.co/a บัตร 1-2345-67890-12-3 ราคา 10000");
  assert.equal(out, "เมล อีเมล โทร เบอร์โทร ดู ลิงก์ บัตร หมายเลข ราคา 10000");
});
