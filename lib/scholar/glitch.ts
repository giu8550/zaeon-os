// Pure text-glitch helpers for the Omega Scholar loading scene.
// Deterministic with a seeded rng (mulberry32) so it can be unit-tested;
// components pass Math.random (or a seeded rng) at runtime.

/** Tiny deterministic PRNG → () => number in [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CJK_START = 0x4e00;
const CJK_END = 0x9fff;
const KATA_START = 0x30a0;
const KATA_END = 0x30ff;

/** One random glyph — mostly CJK ideographs, ~20% katakana for Matrix flavor. */
function randomGlyph(rng: () => number): string {
  if (rng() < 0.2) {
    return String.fromCharCode(KATA_START + Math.floor(rng() * (KATA_END - KATA_START)));
  }
  return String.fromCharCode(CJK_START + Math.floor(rng() * (CJK_END - CJK_START)));
}

/** A string of `len` random CJK/katakana glyphs. */
export function randomCjk(len: number, rng: () => number): string {
  let s = "";
  for (let i = 0; i < Math.max(0, len); i++) s += randomGlyph(rng);
  return s;
}

/**
 * Morph `from` → `to`, revealing the target left-to-right as `progress` (0..1) rises.
 * Unrevealed positions show CJK noise. progress >= 1 returns `to` exactly.
 */
export function scramble(from: string, to: string, progress: number, rng: () => number): string {
  const fromChars = [...from];
  const toChars = [...to];
  const len = Math.max(fromChars.length, toChars.length);
  let out = "";
  for (let i = 0; i < len; i++) {
    const target = toChars[i] ?? "";
    const revealAt = (i + 1) / (len + 1); // earlier positions settle first
    if (progress >= revealAt) {
      out += target;
    } else {
      out += randomGlyph(rng);
    }
  }
  return out;
}
