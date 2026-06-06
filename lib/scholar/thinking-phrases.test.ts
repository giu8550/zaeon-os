import { describe, expect, it } from "vitest";

import { THINKING_STEPS, thinkingState } from "./thinking-phrases";

describe("thinkingState", () => {
  it("starts at the first step with small progress", () => {
    const s = thinkingState(0);
    expect(s.index).toBe(0);
    expect(s.progress).toBeGreaterThanOrEqual(0);
    expect(s.progress).toBeLessThan(0.2);
    expect(s.step).toEqual(THINKING_STEPS[0]);
  });

  it("advances the step over time", () => {
    const early = thinkingState(100).index;
    const later = thinkingState(100 + 3 * 1100).index;
    expect(later).toBeGreaterThan(early);
  });

  it("never exceeds the last step and caps progress below 1", () => {
    const s = thinkingState(1e9);
    expect(s.index).toBe(THINKING_STEPS.length - 1);
    expect(s.progress).toBeLessThanOrEqual(0.95);
    expect(s.progress).toBeGreaterThan(0.5);
  });

  it("index is monotonic non-decreasing", () => {
    let prev = -1;
    for (let t = 0; t < THINKING_STEPS.length * 1100 + 3000; t += 250) {
      const i = thinkingState(t).index;
      expect(i).toBeGreaterThanOrEqual(prev);
      prev = i;
    }
  });
});
