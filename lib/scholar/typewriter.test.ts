import { describe, expect, it } from "vitest";

import { typedLength, typedSlice } from "./typewriter";

describe("typedLength", () => {
  it("is 0 at t=0 and reveals proportionally to elapsed", () => {
    expect(typedLength(100, 0, 30)).toBe(0);
    expect(typedLength(100, 1000, 30)).toBe(30); // 30 cps · 1s
  });

  it("never exceeds the text length", () => {
    expect(typedLength(5, 10000, 30)).toBe(5);
  });
});

describe("typedSlice", () => {
  it("returns a growing prefix", () => {
    expect(typedSlice("hello world", 0, 30)).toBe("");
    expect(typedSlice("hello world", 100, 30)).toBe("hel"); // 0.1s · 30 = 3
    expect(typedSlice("hello world", 5000, 30)).toBe("hello world");
  });

  it("slices by code point (unicode-safe)", () => {
    expect([...typedSlice("héllo", 100, 30)]).toHaveLength(3);
  });
});
