import { describe, expect, it } from "vitest";

import { buildPrereqsSystemPrompt, buildPrereqsUserMessage, sanitizePrereqs } from "./prereqs";
import type { Paper } from "./types";

const paper = (over: Partial<Paper> = {}): Paper => ({
  id: "p1", title: "Graphene synthesis", authors: ["Silva, R."], year: 2023, venue: "Nature", openAccess: true, sources: ["s2"], ...over,
});

describe("buildPrereqsSystemPrompt", () => {
  it("frames the task as prior-knowledge recommendations", () => {
    expect(buildPrereqsSystemPrompt().toLowerCase()).toContain("conhecimentos prévios");
  });
});

describe("buildPrereqsUserMessage", () => {
  it("includes the topic and the reference titles", () => {
    const m = buildPrereqsUserMessage({
      topic: "fotossíntese artificial",
      references: [paper({ title: "Paper A" }), paper({ title: "Paper B" })],
    });
    expect(m).toContain("fotossíntese artificial");
    expect(m).toContain("Paper A");
    expect(m).toContain("Paper B");
  });
});

describe("sanitizePrereqs", () => {
  it("clamps to at most 8 items and keeps the summary", () => {
    const raw = {
      prereqs: Array.from({ length: 20 }, (_, i) => ({ area: `area ${i}`, why: "porque", depth: "básico" })),
      summary: "resumo",
    };
    const out = sanitizePrereqs(raw as any);
    expect(out.prereqs).toHaveLength(8);
    expect(out.summary).toBe("resumo");
  });

  it("drops items without an area", () => {
    const out = sanitizePrereqs({ prereqs: [{ area: "ok", why: "w", depth: "básico" }, { why: "x" }], summary: "" } as any);
    expect(out.prereqs).toHaveLength(1);
    expect(out.prereqs[0].area).toBe("ok");
  });
});
