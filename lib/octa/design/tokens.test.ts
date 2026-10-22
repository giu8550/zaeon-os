import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extrairTokens, tokensComoCss, TOKENS_PADRAO } from "./tokens";

const HEX = /^#[0-9a-f]{6}$/i;
const lerVendor = (id: string) => readFileSync(join(process.cwd(), "vendor/design-md", id, "DESIGN.md"), "utf8");

describe("extrairTokens", () => {
  it("DESIGN.md real (linear.app, escuro) devolve cores #rrggbb e escuro coerente com o fundo", () => {
    const t = extrairTokens(lerVendor("linear.app"), "Linear");
    for (const cor of Object.values(t.cores)) expect(cor).toMatch(HEX);
    expect(t.cores.fundo.toLowerCase()).toBe("#010102");
    expect(t.cores.primaria.toLowerCase()).toBe("#5e6ad2");
    expect(t.escuro).toBe(true);
  });

  it("DESIGN.md real de fundo claro (tesla, formato em prosa) não sai escuro", () => {
    const t = extrairTokens(lerVendor("tesla"), "Tesla");
    for (const cor of Object.values(t.cores)) expect(cor).toMatch(HEX);
    expect(t.escuro).toBe(false);
  });

  it("DESIGN.md sem fontes e sem raio cai em TOKENS_PADRAO (página continua válida)", () => {
    const md = "---\ncolors:\n  primary: \"#ff0000\"\n  canvas: \"#ffffff\"\n  ink: \"#111111\"\n---\n# nada de fonte\n";
    const t = extrairTokens(md);
    expect(t.fontes).toEqual(TOKENS_PADRAO.fontes);
    expect(t.raio).toBe(TOKENS_PADRAO.raio);
    expect(t.espaco).toBe(TOKENS_PADRAO.espaco);
    expect(t.cores.primaria).toBe("#ff0000");
    expect(t.cores.borda).toBe(TOKENS_PADRAO.cores.borda);
  });

  it("texto vazio devolve só defaults", () => {
    expect(extrairTokens("")).toEqual(TOKENS_PADRAO);
  });

  it("anti-marca: nome de fonte proprietária com o nome da marca não vaza", () => {
    const md = "---\ncolors:\n  primary: \"#5e6ad2\"\ntypography:\n  display-lg:\n    fontFamily: Linear Display\n  body:\n    fontFamily: Inter\n---\n";
    const t = extrairTokens(md, "Linear");
    expect(JSON.stringify(t)).not.toMatch(/linear/i);
    expect(t.fontes.titulo).toBe(TOKENS_PADRAO.fontes.titulo);
    expect(t.fontes.corpo).toContain("Inter");
  });
});

describe("tokensComoCss", () => {
  it("emite bloco :root com a primária extraída", () => {
    const t = extrairTokens(lerVendor("linear.app"), "Linear");
    const css = tokensComoCss(t);
    expect(css.startsWith(":root{")).toBe(true);
    expect(css).toContain(`--z-primaria:${t.cores.primaria}`);
    expect(css).toContain("--z-fundo:");
    expect(css).toContain("--z-fonte-titulo:");
    expect(css).toContain("--z-raio:");
  });
});
