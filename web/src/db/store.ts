import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "privacy-chat";
const DB_VERSION = 3;

export type Meta = {
  salt: Uint8Array<ArrayBuffer>;
  verifierIv: Uint8Array<ArrayBuffer>;
  verifierCiphertext: ArrayBuffer;
};

export type StoredMessage = {
  id?: number;
  role: "user" | "assistant";
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
  ts: number;
  source?: "claude" | "second" | "reaction";
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("meta");
          const messages = db.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
          messages.createIndex("ts", "ts");
        }
        if (oldVersion < 2) {
          db.createObjectStore("settings");
        }
        if (oldVersion < 3) {
          const memories = db.createObjectStore("memories", { keyPath: "id", autoIncrement: true });
          memories.createIndex("ts", "ts");
        }
      },
    });
  }
  return dbPromise;
}

export async function getMeta(): Promise<Meta | undefined> {
  const db = await getDb();
  return db.get("meta", "default");
}

export async function setMeta(meta: Meta): Promise<void> {
  const db = await getDb();
  await db.put("meta", meta, "default");
}

export async function addMessage(message: Omit<StoredMessage, "id">): Promise<void> {
  const db = await getDb();
  await db.add("messages", message);
}

export async function getAllMessages(): Promise<StoredMessage[]> {
  const db = await getDb();
  return db.getAllFromIndex("messages", "ts");
}

export async function wipeAll(): Promise<void> {
  const db = await getDb();
  await db.clear("meta");
  await db.clear("messages");
  await db.clear("settings");
  await db.clear("memories");
}

// Panic path: empty every store first (so the data is gone even if the delete
// below is blocked by another open tab), then drop the whole database. Never
// throws — a half-failed wipe must not stop the caller from leaving the page.
export async function destroyDatabase(): Promise<void> {
  try {
    await wipeAll();
    const db = await getDb();
    db.close();
    dbPromise = null;
  } catch {
    // fall through to the delete attempt
  }
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

export type EncryptedBlob = { iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer };

export async function getPersonaNote(): Promise<EncryptedBlob | undefined> {
  const db = await getDb();
  return db.get("settings", "personaNote");
}

export async function setPersonaNote(blob: EncryptedBlob): Promise<void> {
  const db = await getDb();
  await db.put("settings", blob, "personaNote");
}

export type StoredMemory = { id?: number; iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer; ts: number };

export async function addMemory(memory: Omit<StoredMemory, "id">): Promise<number> {
  const db = await getDb();
  return db.add("memories", memory) as Promise<number>;
}

export async function getAllMemories(): Promise<StoredMemory[]> {
  const db = await getDb();
  return db.getAllFromIndex("memories", "ts");
}

export async function deleteMemory(id: number): Promise<void> {
  const db = await getDb();
  await db.delete("memories", id);
}

// Cross-device move without a sync server: every field below is already
// ciphertext (or the salt/IV needed to derive the key — never the
// passphrase itself), so the exported file is safe to move over any
// channel (AirDrop, USB, email) — only someone with the original passphrase
// can ever decrypt it. This is a deliberate alternative to server-side
// sync, which would require a server that can see decrypted content.
export type VaultExport = {
  version: 1;
  exportedAt: number;
  meta: { salt: string; verifierIv: string; verifierCiphertext: string } | null;
  messages: Array<{ role: "user" | "assistant"; iv: string; ciphertext: string; ts: number; source?: StoredMessage["source"] }>;
  memories: Array<{ iv: string; ciphertext: string; ts: number }>;
  personaNote: { iv: string; ciphertext: string } | null;
};

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function exportVault(): Promise<VaultExport> {
  const db = await getDb();
  const [meta, messages, memories, personaNote] = await Promise.all([
    db.get("meta", "default") as Promise<Meta | undefined>,
    db.getAllFromIndex("messages", "ts") as Promise<StoredMessage[]>,
    db.getAllFromIndex("memories", "ts") as Promise<StoredMemory[]>,
    db.get("settings", "personaNote") as Promise<EncryptedBlob | undefined>,
  ]);

  return {
    version: 1,
    exportedAt: Date.now(),
    meta: meta
      ? { salt: bufToBase64(meta.salt), verifierIv: bufToBase64(meta.verifierIv), verifierCiphertext: bufToBase64(meta.verifierCiphertext) }
      : null,
    messages: messages.map((m) => ({
      role: m.role,
      iv: bufToBase64(m.iv),
      ciphertext: bufToBase64(m.ciphertext),
      ts: m.ts,
      source: m.source,
    })),
    memories: memories.map((m) => ({ iv: bufToBase64(m.iv), ciphertext: bufToBase64(m.ciphertext), ts: m.ts })),
    personaNote: personaNote ? { iv: bufToBase64(personaNote.iv), ciphertext: bufToBase64(personaNote.ciphertext) } : null,
  };
}

// Only meant for a brand-new/empty device — refuses if a vault already
// exists here, since merging two independently-encrypted vaults (possibly
// under different passphrases) isn't a safe operation to do silently.
export async function importVault(data: VaultExport): Promise<void> {
  const db = await getDb();
  const existing = await db.get("meta", "default");
  if (existing) {
    throw new Error("Device already has a vault — import is only for a fresh device.");
  }

  if (data.meta) {
    await db.put(
      "meta",
      {
        salt: base64ToBytes(data.meta.salt),
        verifierIv: base64ToBytes(data.meta.verifierIv),
        verifierCiphertext: base64ToBytes(data.meta.verifierCiphertext).buffer,
      } satisfies Meta,
      "default"
    );
  }
  for (const m of data.messages) {
    await db.add("messages", {
      role: m.role,
      iv: base64ToBytes(m.iv),
      ciphertext: base64ToBytes(m.ciphertext).buffer,
      ts: m.ts,
      source: m.source,
    } satisfies Omit<StoredMessage, "id">);
  }
  for (const m of data.memories) {
    await db.add("memories", {
      iv: base64ToBytes(m.iv),
      ciphertext: base64ToBytes(m.ciphertext).buffer,
      ts: m.ts,
    } satisfies Omit<StoredMemory, "id">);
  }
  if (data.personaNote) {
    await db.put(
      "settings",
      { iv: base64ToBytes(data.personaNote.iv), ciphertext: base64ToBytes(data.personaNote.ciphertext).buffer } satisfies EncryptedBlob,
      "personaNote"
    );
  }
}
