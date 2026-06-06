import { describe, expect, it } from "vitest";

import { mulberry32, randomCjk, scramble } from "./glitch";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("produces values in [0,1)", () => {
    const r = mulberry32(99);
    for (let i = 0; i < 50; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("randomCjk", () => {
  it("returns exactly len glyphs inside CJK/katakana ranges", () => {
    const s = randomCjk(20, mulberry32(7));
    expect([...s]).toHaveLength(20);
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      const inCjk = c >= 0x4e00 && c <= 0x9fff;
      const inKata = c >= 0x30a0 && c <= 0x30ff;
      expect(inCjk || inKata).toBe(true);
    }
  });

  it("is deterministic with a seeded rng", () => {
    expect(randomCjk(8, mulberry32(3))).toBe(randomCjk(8, mulberry32(3)));
  });
});

describe("scramble", () => {
  it("returns the target exactly at progress 1", () => {
    expect(scramble("hello", "你好世界", 1, mulberry32(1))).toBe("你好世界");
  });

  it("reveals the target left-to-right as progress increases", () => {
    // to='hello' (len 5): reveal thresholds (i+1)/6 = .167 .333 .5 .667 .833
    expect(scramble("xxxxx", "hello", 0.5, mulberry32(1)).startsWith("hel")).toBe(true);
    expect(scramble("xxxxx", "hello", 0.9, mulberry32(1)).startsWith("hell")).toBe(true);
  });

  it("is pure noise (not the target) at progress 0", () => {
    const out = scramble("abc", "abc", 0, mulberry32(1));
    expect([...out]).toHaveLength(3);
    expect(out).not.toBe("abc");
  });

  it("handles targets longer or shorter than source", () => {
    expect(scramble("hi", "你好世界", 1, mulberry32(1))).toBe("你好世界");
    expect(scramble("你好世界", "hi", 1, mulberry32(1))).toBe("hi");
  });
});
