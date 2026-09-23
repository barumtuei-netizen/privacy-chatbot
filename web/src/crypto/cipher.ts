const IV_BYTES = 12;

export type Encrypted = { iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer };

export async function encryptText(key: CryptoKey, plaintext: string): Promise<Encrypted> {
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { iv, ciphertext };
}

export async function decryptText(key: CryptoKey, iv: Uint8Array<ArrayBuffer>, ciphertext: ArrayBuffer): Promise<string> {
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plainBuf);
}
