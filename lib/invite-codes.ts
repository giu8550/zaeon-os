import { randomBytes } from "crypto";

// Uppercase alphanumeric, excluding ambiguous chars: 0, O, 1, I
export const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generates a random 8-character invite code formatted as XXXX-XXXX.
 * Uses crypto.randomBytes for uniform distribution over CHARSET.
 */
export function generateCode(): string {
  const chars: string[] = [];
  // Generate more bytes than needed to avoid modulo bias
  const bytes = randomBytes(16);
  let idx = 0;

  while (chars.length < 8) {
    const byte = bytes[idx % bytes.length];
    idx++;
    // Reject bytes that would introduce bias (reject values >= floor(256 / CHARSET.length) * CHARSET.length)
    const max = Math.floor(256 / CHARSET.length) * CHARSET.length;
    if (byte < max) {
      chars.push(CHARSET[byte % CHARSET.length]);
    }
    // If we ran out of bytes, get more (rare)
    if (idx >= bytes.length && chars.length < 8) {
      const more = randomBytes(16);
      more.forEach((b, i) => { (bytes as any)[i] = b; });
      idx = 0;
    }
  }

  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** Returns true if `code` matches the XXXX-XXXX format using only CHARSET chars. */
export function validateCodeFormat(code: string): boolean {
  return /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code);
}
