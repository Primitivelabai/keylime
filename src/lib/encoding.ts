export type Bytes = Uint8Array<ArrayBuffer>;

/**
 * Converts an ArrayBuffer or Uint8Array into a URL-safe Base64 string without padding.
 */
export function bytesToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Decodes a Base64URL string into a Uint8Array.
 */
export function base64UrlToBytes(base64url: string): Bytes {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Formats bytes as a lowercase hexadecimal string (with optional byte separator).
 */
export function bytesToHex(buffer: ArrayBuffer | Uint8Array, separator = ''): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(separator);
}

/**
 * Parses a clean hexadecimal string into a Uint8Array.
 */
export function hexToBytes(hex: string): Bytes {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) {
    throw new Error('Hex string must have an even number of characters');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Concatenates multiple Uint8Arrays into a single contiguous Uint8Array.
 */
export function concatBytes(...arrays: Bytes[]): Bytes {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.byteLength;
  }
  return result;
}

/**
 * Constant-time-style byte equality check.
 */
export function bytesEqual(a: Bytes, b: Bytes): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
