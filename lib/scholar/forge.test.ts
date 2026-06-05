import { describe, expect, it } from "vitest";

import { buildForgeRequest, paperToIncomingRef } from "./forge";
import type { Paper } from "./types";

const paper = (over: Partial<Paper> = {}): Paper => ({
  id: "p1",
  title: "A valid paper title about graphene",
  authors: ["Silva, R."],
  year: 2023,
  venue: "Nature",
  openAccess: true,
  sources: ["s2"],
  ...over,
});

describe("paperToIncomingRef", () => {
  it("coerces a valid paper", () => {
    const r = paperToIncomingRef(paper())!;
    expect(r.year).toBe("2023");
    expect(r.authors).toBe("Silva, R.");
    expect(r.venue).toBe("Nature");
  });

  it("drops papers without a 4-digit year", () => {
    expect(paperToIncomingRef(paper({ year: undefined }))).toBeNull();
  });

  it("nulls non-pattern DOIs and keeps valid ones", () => {
    expect(paperToIncomingRef(paper({ doi: "not-a-doi" }))!.doi).toBeNull();
    expect(paperToIncomingRef(paper({ doi: "10.1038/nature11875" }))!.doi).toBe("10.1038/nature11875");
  });

  it("falls back venue/authors when missing", () => {
    const r = paperToIncomingRef(paper({ venue: "", authors: [] }))!;
    expect(r.venue).toBe("Preprint");
    expect(r.authors).toBe("Autoria não informada");
  });
});

describe("buildForgeRequest", () => {
  it("errors with fewer than 3 valid references", () => {
    const out = buildForgeRequest({
      topic: "x",
      level: "phd",
      references: [paper(), paper({ year: undefined })],
    });
    expect("error" in out).toBe(true);
  });

  it("builds a clamped request with >= 3 valid references", () => {
    const out = buildForgeRequest({
      topic: "graphene oxide synthesis",
      level: "phd",
      references: [paper(), paper(), paper()],
      count: 99,
    });
    expect("error" in out).toBe(false);
    if (!("error" in out)) {
      expect(out.count).toBe(10);
      expect(out.references).toHaveLength(3);
      expect(out.user_level).toBe("phd");
    }
  });
});
