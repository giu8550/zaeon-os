import { describe, expect, it } from "vitest";

import { agentNarrative, progressFor } from "./loading-phases";

const ph = (...names: string[]) => names.map((phase) => ({ phase }));

describe("progressFor", () => {
  it("is 0 when idle and 1 when done", () => {
    expect(progressFor([], "idle")).toBe(0);
    expect(progressFor(ph("verifying"), "done")).toBe(1);
  });

  it("gives a small nonzero value when running with no phases yet", () => {
    const p = progressFor([], "running");
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.2);
  });

  it("ramps while searching as more sources arrive (capped)", () => {
    const one = progressFor(ph("planning", "searching"), "running");
    const many = progressFor(ph("planning", "searching", "searching", "searching", "searching"), "running");
    expect(many).toBeGreaterThan(one);
    expect(many).toBeLessThanOrEqual(0.55);
  });

  it("increases monotonically across the canonical phase sequence", () => {
    const seq = ["planning", "searching", "dedup", "synthesizing", "verifying"];
    let prev = -1;
    for (let i = 0; i < seq.length; i++) {
      const cur = progressFor(ph(...seq.slice(0, i + 1)), "running");
      expect(cur).toBeGreaterThan(prev);
      prev = cur;
    }
  });
});

describe("agentNarrative", () => {
  it("reframes searching with the real source count", () => {
    const n = agentNarrative({ phase: "searching", message: "✓ arXiv: 23 papers" });
    expect(n.icon).toBe("⟁");
    expect(n.text).toContain("arXiv");
    expect(n.text).toContain("23");
  });

  it("keeps the verified-citation count", () => {
    const n = agentNarrative({ phase: "verifying", message: "✓ 12 citações confirmadas" });
    expect(n.icon).toBe("✓");
    expect(n.text).toContain("12");
  });

  it("frames planning and synthesizing as agent activity", () => {
    expect(agentNarrative({ phase: "planning" }).text.toLowerCase()).toContain("agente");
    expect(agentNarrative({ phase: "synthesizing" }).icon).toBe("✶");
  });

  it("uses the dedup icon", () => {
    expect(agentNarrative({ phase: "dedup", message: "✓ 31 pesquisas · full-text de 5" }).icon).toBe("⊹");
  });
});
