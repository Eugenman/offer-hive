import { createHash, timingSafeEqual } from "node:crypto";

// The recovery code resets a forgotten password without email verification. 16 characters from
// an alphabet without look-alikes (no 0/O, 1/I/L), about 79 bits: guessing it is not practical,
// so a fast hash is enough. Only the hash is stored.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 16;
// The largest multiple of the alphabet size below 256: bytes above it are skipped, so every
// character is equally likely.
const BYTE_LIMIT = 256 - (256 % ALPHABET.length);

/** A new code, shown as XXXX-XXXX-XXXX-XXXX. */
export function generateRecoveryCode(): string {
  const chars: string[] = [];
  while (chars.length < LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      if (byte < BYTE_LIMIT && chars.length < LENGTH) chars.push(ALPHABET[byte % ALPHABET.length]);
    }
  }
  return chars.join("").match(/.{4}/g)!.join("-");
}

/** What people type: any case, spaces or dashes. Keeps only the code's own characters. */
export function normalizeRecoveryCode(input: string): string {
  return [...input.toUpperCase()].filter((char) => ALPHABET.includes(char)).join("");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

/** Whether the typed code matches the stored hash, compared in constant time. */
export function recoveryCodeMatches(input: string, storedHash: string | null): boolean {
  if (!storedHash || normalizeRecoveryCode(input).length !== LENGTH) return false;
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashRecoveryCode(input), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
