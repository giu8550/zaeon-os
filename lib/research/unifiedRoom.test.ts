import { describe, it, expect, afterEach, vi } from "vitest";
import { resolveLabTab, isSubTab, unifiedResearchRoom, projetosOn } from "./unifiedRoom";

describe("resolveLabTab", () => {
  it("rejeita aba inválida", () => {
    expect(resolveLabTab("xyz", true)).toBeNull();
    expect(resolveLabTab(undefined, false)).toBeNull();
    expect(resolveLabTab(42, true)).toBeNull();
  });

  it("flag off: devolve a aba como veio (layout atual)", () => {
    expect(resolveLabTab("sala-de-estudos", false)).toEqual({ tab: "sala-de-estudos" });
    expect(resolveLabTab("pesquisas", false)).toEqual({ tab: "pesquisas" });
    expect(resolveLabTab("lounge", false)).toBeNull(); // o Lounge saiu do laboratório (vive no cyberespaço)
  });

  it("duas salas: Estudos é sala de topo (sem alias); só 'pesquisas' vira sub-aba da Pesquisa", () => {
    expect(resolveLabTab("sala-de-estudos", true)).toEqual({ tab: "sala-de-estudos" });
    expect(resolveLabTab("pesquisas", true)).toEqual({ tab: "pesquisa", subTab: "pesquisas" });
  });

  it("flag on: pesquisa não força sub-aba; outras abas passam", () => {
    expect(resolveLabTab("pesquisa", true)).toEqual({ tab: "pesquisa" });
    expect(resolveLabTab("escritorio", true)).toEqual({ tab: "escritorio" });
    expect(resolveLabTab("profile", true)).toEqual({ tab: "profile" });
  });

  it("Projetos escondido: ?tab=projetos cai na Sala de Pesquisa (nos dois layouts); ligado, passa", () => {
    expect(resolveLabTab("projetos", true, false)).toEqual({ tab: "pesquisa" });
    expect(resolveLabTab("projetos", false, false)).toEqual({ tab: "pesquisa" });
    expect(resolveLabTab("projetos", true, true)).toEqual({ tab: "projetos" });
  });
});

describe("isSubTab", () => {
  it("aceita só chat/pesquisas ('estudos' deixou de ser sub-aba)", () => {
    expect(isSubTab("chat")).toBe(true);
    expect(isSubTab("pesquisas")).toBe(true);
    expect(isSubTab("estudos")).toBe(false);
    expect(isSubTab("aulas")).toBe(false);
    expect(isSubTab(null)).toBe(false);
  });
});

describe("flags", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("unified: off por padrão; liga com 1/true", () => {
    vi.stubEnv("NEXT_PUBLIC_UNIFIED_RESEARCH_ROOM", ""); vi.stubEnv("UNIFIED_RESEARCH_ROOM", "");
    expect(unifiedResearchRoom()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_UNIFIED_RESEARCH_ROOM", "1"); expect(unifiedResearchRoom()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_UNIFIED_RESEARCH_ROOM", "true"); expect(unifiedResearchRoom()).toBe(true);
  });
  it("projetos: off por padrão; liga com on/1/true (case-insens.)", () => {
    vi.stubEnv("NEXT_PUBLIC_PROJETOS", ""); expect(projetosOn()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_PROJETOS", "off"); expect(projetosOn()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_PROJETOS", "ON"); expect(projetosOn()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_PROJETOS", "1"); expect(projetosOn()).toBe(true);
  });
});
