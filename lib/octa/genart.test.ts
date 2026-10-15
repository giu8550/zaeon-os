import { describe, it, expect } from "vitest";
import { gerarPeca, verificarDeterminismo, ehPedidoDeArte } from "./genart";
import { carregarSkill, skillsDoOcta, OCTA_SKILLS } from "./skills";

describe("octa · genart (§7)", () => {
  it("mesma seed reproduz a peça byte a byte", () => {
    expect(gerarPeca("zaeon-42").svg).toBe(gerarPeca("zaeon-42").svg);
    expect(verificarDeterminismo("zaeon-42").ok).toBe(true);
  });
  it("seeds diferentes divergem", () => {
    const hs = new Set(["a", "b", "c", "d", "e"].map((s) => gerarPeca(s).hash));
    expect(hs.size).toBe(5);
  });
  it("vira artefato SVG com traços", () => {
    const p = gerarPeca("x");
    expect(p.svg.startsWith("<svg")).toBe(true);
    expect(p.tipo).toBe("genart");
    expect(Object.keys(p.tracos)).toEqual(["paleta", "fios", "ondulacao"]);
  });
  it("detecta pedido de arte", () => {
    expect(ehPedidoDeArte("faz uma arte generativa pra mim")).toBe(true);
    expect(ehPedidoDeArte("qual o estado da arte em LLMs?")).toBe(false);
  });
});

describe("octa · skills vendorizadas (§7/§8)", () => {
  it.each(OCTA_SKILLS)("%s instala standalone e valida", async (nome) => {
    const s = await carregarSkill(nome);
    expect(s.manifest.name).toBe(nome);
    expect(s.manifest.description.length).toBeGreaterThan(20);
    expect(s.corpo.length).toBeGreaterThan(500);
  });
  it("progressive disclosure: prompt só com nome+descrição, corpo via activate_skill (sem MCP)", async () => {
    const { prompt, activate } = await skillsDoOcta();
    expect(prompt).toContain("genart");
    expect(prompt).toContain("appllama-app-design-skill");
    expect(prompt).not.toContain("## The Prime Directive");
    const r = await activate.run({ name: "appllama-app-design-skill" }, {} as any);
    expect(r.ok).toBe(true);
  });
});
