import { describe, it, expect } from "vitest";
import { FONTES_ABERTAS } from "./tokens";
import { carregarIndice, lerDesignMd, candidatosPorDescricao } from "./indice";

describe("carregarIndice / lerDesignMd", () => {
  it("lê o índice vendorizado com os 84 estilos e campos completos", () => {
    const ind = carregarIndice();
    expect(ind.length).toBe(84);
    for (const e of ind) {
      expect(e.id).toBeTruthy();
      expect(e.nome).toBeTruthy();
      expect(e.marca).toBeTruthy();
      expect(e.tokens.cores.primaria).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // marca = nome da pasta sem TLD, capitalizado
    expect(ind.find((e) => e.id === "linear.app")?.marca).toBe("Linear");
  });

  it("lerDesignMd devolve o markdown e recusa id fora do índice (path traversal)", () => {
    expect(lerDesignMd("linear.app")).toContain("#5e6ad2");
    expect(() => lerDesignMd("../../package.json")).toThrow();
    expect(() => lerDesignMd("nao-existe")).toThrow();
  });
});

describe("candidatosPorDescricao", () => {
  const ind = carregarIndice();

  it("'escura e minimalista' só traz estilos escuros entre os 3 primeiros", () => {
    const top = candidatosPorDescricao("escura e minimalista", ind);
    expect(top.length).toBe(5);
    for (const e of top.slice(0, 3)) expect(e.tokens.escuro).toBe(true);
  });

  it("'clara' não traz estilo escuro no topo", () => {
    const top = candidatosPorDescricao("uma página clara e corporativa", ind);
    for (const e of top.slice(0, 3)) expect(e.tokens.escuro).toBe(false);
  });

  it("respeita n e é determinístico", () => {
    const a = candidatosPorDescricao("divertida", ind, 2);
    expect(a.length).toBe(2);
    expect(candidatosPorDescricao("divertida", ind, 2).map((e) => e.id)).toEqual(a.map((e) => e.id));
  });

  it("nome da marca na descrição puxa o estilo", () => {
    expect(candidatosPorDescricao("quero algo estilo stripe", ind, 1)[0].id).toBe("stripe");
  });
});

describe("anti-marca no índice real", () => {
  const ind = carregarIndice();

  it("nenhuma palavra (3+ letras) da marca aparece nos tokens de nenhum estilo", () => {
    for (const e of ind) {
      const json = JSON.stringify(e.tokens).toLowerCase();
      for (const w of e.marca.toLowerCase().split(/[^a-z0-9]+/).filter((p) => p.length >= 3)) {
        expect(json, `${e.id} vaza "${w}"`).not.toContain(w);
      }
    }
  });

  it("toda família de fonte nos tokens está na lista aberta (ou é do sistema)", () => {
    for (const e of ind) {
      for (const pilha of Object.values(e.tokens.fontes)) {
        const primeira = pilha.split(",")[0].trim().replace(/^"|"$/g, "").toLowerCase();
        const ok = primeira === "system-ui" || FONTES_ABERTAS.has(primeira);
        expect(ok, `${e.id}: ${primeira}`).toBe(true);
      }
    }
  });
});
