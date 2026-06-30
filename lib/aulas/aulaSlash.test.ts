import { describe, it, expect } from "vitest";
import { AULA_SLASH_OPTIONS, filterAulaSlash } from "@/lib/aulas/aulaSlash";

describe("aula slash options", () => {
  it("expõe os 4 tipos prontos com kind aula", () => {
    expect(AULA_SLASH_OPTIONS).toHaveLength(4);
    expect(AULA_SLASH_OPTIONS.every((o) => o.kind === "aula")).toBe(true);
    expect(AULA_SLASH_OPTIONS.map((o) => o.key).sort()).toEqual(["q-choice", "q-roulette", "q-voice", "q-written"]);
  });
  it("filtra sem acento/case por label e key", () => {
    expect(filterAulaSlash("voz").map((o) => o.key)).toContain("q-voice");
    expect(filterAulaSlash("ESCOLHA").map((o) => o.key)).toContain("q-choice");
    expect(filterAulaSlash("q-roulette").map((o) => o.key)).toEqual(["q-roulette"]);
    expect(filterAulaSlash("")).toHaveLength(4);
  });
  it("sem match → vazio", () => {
    expect(filterAulaSlash("zzz")).toEqual([]);
  });
});
