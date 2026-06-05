import { describe, expect, it } from "vitest";

import { buildPastResearchSystemPrompt, extractSection } from "./omega";

const SAMPLE = `# Doc

## 1. IDENTIDADE
identity line one
identity line two

## 2. OUTRO
\`\`\`
## fake header inside fence
\`\`\`
still in section two

## 3. FIM
end
`;

describe("extractSection", () => {
  it("returns the matching block and stops at the next same-level header", () => {
    const out = extractSection(SAMPLE, "IDENTIDADE");
    expect(out).toContain("identity line one");
    expect(out).toContain("identity line two");
    expect(out).not.toContain("OUTRO");
  });

  it("ignores headers inside code fences", () => {
    const out = extractSection(SAMPLE, "OUTRO");
    expect(out).toContain("fake header inside fence"); // fenced — not a real boundary
    expect(out).toContain("still in section two");
    expect(out).not.toContain("FIM");
  });

  it("returns empty string when the keyword is absent", () => {
    expect(extractSection(SAMPLE, "NAO EXISTE")).toBe("");
  });
});

describe("buildPastResearchSystemPrompt", () => {
  it("injects the title and a no-references warning when refs are empty", () => {
    const sp = buildPastResearchSystemPrompt({ title: "Graphene Bio-synthesis" });
    expect(sp).toContain("Graphene Bio-synthesis");
    expect(sp).toContain("NÃO invente citações");
  });

  it("lists references with [ref:N] indices when present", () => {
    const sp = buildPastResearchSystemPrompt({
      title: "X",
      references: [{ title: "Paper A" }, { title: "Paper B" }],
    });
    expect(sp).toContain("[ref:N]");
    expect(sp).toContain("[0] Paper A");
    expect(sp).toContain("[1] Paper B");
  });
});
