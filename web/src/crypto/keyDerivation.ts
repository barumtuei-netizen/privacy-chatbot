import { argon2id } from "hash-wasm";

const SALT_BYTES = 16;
const KEY_BYTES = 32;

export const ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536, // 64 MB
};

export function generateSalt(): Uint8Array<ArrayBuffer> {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return salt;
}

export async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const raw = await argon2id({
    password: passphrase,
    salt,
    ...ARGON2_PARAMS,
    hashLength: KEY_BYTES,
    outputType: "binary",
  });

  const keyBytes: Uint8Array<ArrayBuffer> = new Uint8Array(raw);
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
