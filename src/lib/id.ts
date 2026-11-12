/**
 * A random identifier.
 *
 * `crypto.randomUUID()` only exists in a secure context. The app is opened over plain HTTP on a
 * phone in the local network (http://192.168.x.x:3000), where that function is missing and every
 * write failed with "crypto.randomUUID is not a function". `getRandomValues` works everywhere, so
 * the UUID is assembled by hand when the built-in one is absent.
 */
export function newId(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();

  const bytes = webCrypto.getRandomValues(new Uint8Array(16));
  // Version 4 and the RFC 4122 variant, exactly as randomUUID would set them.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
