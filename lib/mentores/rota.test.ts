import { describe, it, expect } from "vitest";
import { mentoresTab, lojaHref, lojaLabel, adminLabelPlugins, destinoDaLoja, categoriasLoja } from "./rota";

describe("rota da loja (NEXT_PUBLIC_MENTORES_TAB)", () => {
  it("flag off: tudo como hoje", () => {
    expect(mentoresTab({})).toBe(false);
    expect(lojaHref("/x", false)).toBe("/plugin-store?from=/x");
    expect(lojaLabel(false)).toBe("Assistentes");
    expect(adminLabelPlugins(false)).toBe("Plugins");
    expect(destinoDaLoja(false, "?from=/x")).toBeNull();
    expect(categoriasLoja(false)).toEqual({ categorias: ["Todos", "Essencial", "Agentes", "Mentores"], padrao: "Todos" });
  });
  it("flag on: /mentores, 'Mentores' primeiro e default, labels novos", () => {
    expect(mentoresTab({ NEXT_PUBLIC_MENTORES_TAB: "1" })).toBe(true);
    expect(mentoresTab({ NEXT_PUBLIC_MENTORES_TAB: "on" })).toBe(true);
    expect(lojaHref("/research-lab?tab=sala-de-estudos", true)).toBe("/mentores?from=/research-lab?tab=sala-de-estudos");
    expect(lojaHref(null, true)).toBe("/mentores");
    expect(lojaLabel(true)).toBe("Mentores");
    expect(adminLabelPlugins(true)).toBe("Mentores · catálogo");
    expect(categoriasLoja(true)).toEqual({ categorias: ["Mentores", "Todos", "Essencial", "Agentes"], padrao: "Mentores" });
  });
  it("destinoDaLoja preserva a query (deep-links antigos continuam válidos)", () => {
    expect(destinoDaLoja(true, "?from=/research-lab?tab=projetos")).toBe("/mentores?from=/research-lab?tab=projetos");
    expect(destinoDaLoja(true, "")).toBe("/mentores");
    expect(destinoDaLoja(true, "?")).toBe("/mentores");
  });
});
