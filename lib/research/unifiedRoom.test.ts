import { describe, it, expect, afterEach, vi } from "vitest";
import { resolveLabTab, isSubTab, unifiedResearchRoom } from "./unifiedRoom";

describe("resolveLabTab", () => {
  it("rejeita aba inválida", () => {
    expect(resolveLabTab("xyz", true)).toBeNull();
    expect(resolveLabTab(undefined, false)).toBeNull();
    expect(resolveLabTab(42, true)).toBeNull();
  });

  it("flag off: devolve a aba como veio (layout atual)", () => {
    expect(resolveLabTab("sala-de-estudos", false)).toEqual({ tab: "sala-de-estudos" });
    expect(resolveLabTab("pesquisas", false)).toEqual({ tab: "pesquisas" });
    expect(resolveLabTab("lounge", false)).toEqual({ tab: "lounge" });
  });

  it("flag on: abas antigas viram sub-abas da Sala de Pesquisa", () => {
    expect(resolveLabTab("sala-de-estudos", true)).toEqual({ tab: "pesquisa", subTab: "estudos" });
    expect(resolveLabTab("pesquisas", true)).toEqual({ tab: "pesquisa", subTab: "pesquisas" });
  });

  it("flag on: pesquisa não força sub-aba; outras abas passam", () => {
    expect(resolveLabTab("pesquisa", true)).toEqual({ tab: "pesquisa" });
    expect(resolveLabTab("escritorio", true)).toEqual({ tab: "escritorio" });
    expect(resolveLabTab("profile", true)).toEqual({ tab: "profile" });
  });
});

describe("isSubTab", () => {
  it("aceita só chat/estudos/pesquisas", () => {
    expect(isSubTab("chat")).toBe(true);
    expect(isSubTab("estudos")).toBe(true);
    expect(isSubTab("pesquisas")).toBe(true);
    expect(isSubTab("aulas")).toBe(false);
    expect(isSubTab(null)).toBe(false);
  });
});

describe("unifiedResearchRoom (flag)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("off por padrão", () => {
    vi.stubEnv("NEXT_PUBLIC_UNIFIED_RESEARCH_ROOM", "");
    vi.stubEnv("UNIFIED_RESEARCH_ROOM", "");
    expect(unifiedResearchRoom()).toBe(false);
  });
  it("liga com 1/true", () => {
    vi.stubEnv("NEXT_PUBLIC_UNIFIED_RESEARCH_ROOM", "1");
    expect(unifiedResearchRoom()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_UNIFIED_RESEARCH_ROOM", "true");
    expect(unifiedResearchRoom()).toBe(true);
  });
});
