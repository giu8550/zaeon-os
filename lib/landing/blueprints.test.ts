import { describe, it, expect } from "vitest";
import { paraPublico, urlSegura, validarBlueprint } from "@/lib/landing/blueprints";

describe("urlSegura", () => {
  it("aceita https, http e caminho do site", () => {
    expect(urlSegura("https://zaeon.com.br/x.png")).toBe("https://zaeon.com.br/x.png");
    expect(urlSegura("http://a.com/")).toBe("http://a.com/");
    expect(urlSegura("/assets/bp.png")).toBe("/assets/bp.png");
  });
  it("vazio vira null; javascript:, data: e // são recusados", () => {
    expect(urlSegura("  ")).toBeNull();
    expect(urlSegura(undefined)).toBeNull();
    expect(urlSegura("javascript:alert(1)")).toBeUndefined();
    expect(urlSegura("data:text/html,x")).toBeUndefined();
    expect(urlSegura("//evil.com/x")).toBeUndefined();
    expect(urlSegura(42)).toBeUndefined();
  });
});

describe("validarBlueprint (criar)", () => {
  it("normaliza e aplica os padrões", () => {
    const v = validarBlueprint({ title: "  Cidade solar ", tags: "energia, game, energia" }, false);
    expect(v).toEqual({ ok: true, dados: { title: "Cidade solar", description: null, imageUrl: null, href: null, tags: ["energia", "game"], published: false, order: 0 } });
  });
  it("título é obrigatório", () => {
    expect(validarBlueprint({ title: "  " }, false)).toEqual({ ok: false, erro: "titulo_obrigatorio" });
    expect(validarBlueprint(null, false)).toEqual({ ok: false, erro: "corpo_invalido" });
  });
  it("recusa link perigoso, ordem quebrada e publicado não-booleano", () => {
    expect(validarBlueprint({ title: "x", href: "javascript:alert(1)" }, false)).toEqual({ ok: false, erro: "link_invalido" });
    expect(validarBlueprint({ title: "x", order: 1.5 }, false)).toEqual({ ok: false, erro: "ordem_invalida" });
    expect(validarBlueprint({ title: "x", published: "sim" }, false)).toEqual({ ok: false, erro: "publicado_invalido" });
  });
});

describe("validarBlueprint (PATCH)", () => {
  it("só devolve o que veio", () => {
    expect(validarBlueprint({ published: true }, true)).toEqual({ ok: true, dados: { published: true } });
  });
  it("corpo vazio não é update", () => {
    expect(validarBlueprint({}, true)).toEqual({ ok: false, erro: "nada_para_atualizar" });
  });
});

describe("paraPublico", () => {
  it("não vaza published/order/datas", () => {
    const pub = paraPublico({ id: "1", title: "T", published: false, order: 3, createdAt: new Date() } as any);
    expect(pub).toEqual({ id: "1", title: "T", description: null, imageUrl: null, href: null, tags: [] });
  });
});
