import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOKENS_PADRAO, tokensComoCss, type TokensDesign } from "../design/tokens";
import { carregarIndice } from "../design/indice";
import { renderPagina } from "./render";
import { PROPS_MINIMAS, TIPOS_SECAO, VARIANTES_POR_CLIMA, validarSecoes, type Secao } from "./tipos";

const base = { titulo: "Padaria Aurora", descricao: "Pães artesanais em Fortaleza", tokens: TOKENS_PADRAO };
const sec = (type: string, props: Record<string, unknown> = {}, id = "a"): Secao => ({ id, type: type as Secao["type"], props });

describe("renderPagina", () => {
  const { "index.html": html, "styles.css": css } = renderPagina({
    ...base,
    secoes: [
      sec("hero", PROPS_MINIMAS.hero, "h"),
      sec("features", PROPS_MINIMAS.features, "f"),
      sec("cta", PROPS_MINIMAS.cta, "c"),
    ],
  });

  it("devolve um documento estático completo em pt-BR", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain('<link rel="stylesheet" href="styles.css">');
    expect(html).toContain("<title>Padaria Aurora</title>");
    expect(html).toContain('<meta name="description" content="Pães artesanais em Fortaleza">');
    expect(html).toContain('<meta name="viewport"');
    expect(html).not.toContain("<script");
  });

  it("styles.css = bloco de tokens seguido de secoes.css", () => {
    const secoes = readFileSync(join(process.cwd(), "lib/octa/secoes/secoes.css"), "utf8");
    expect(css.startsWith(tokensComoCss(TOKENS_PADRAO))).toBe(true);
    expect(css).toBe(tokensComoCss(TOKENS_PADRAO) + "\n" + secoes);
  });

  it("escapa HTML nas props (e no título/descrição da página)", () => {
    const out = renderPagina({
      titulo: "<b>x</b>",
      descricao: '"><script>1</script>',
      tokens: TOKENS_PADRAO,
      secoes: [sec("hero", { title: "<script>alert(1)</script>", subtitle: '<img src=x onerror="a">', ctaText: "ok" })],
    })["index.html"];
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img src=x");
    expect(out).not.toContain("<b>x</b>");
  });

  it("recusa esquemas perigosos em links e imagens", () => {
    const out = renderPagina({
      ...base,
      secoes: [sec("hero", { title: "t", ctaText: "go", ctaLink: "javascript:alert(1)", backgroundImage: "javascript:alert(2)" })],
    })["index.html"];
    expect(out).not.toContain("javascript:");
    expect(out).toContain('href="#contato"');
  });

  it("recusa esquemas disfarçados (tab, quebra de linha, controle C0, maiúsculas, data:)", () => {
    const ruins = ["java\tscript:alert(1)", "java\nscript:alert(3)", "\u0001javascript:alert(2)", "JAVASCRIPT:alert(4)", "data:text/html,<b>x</b>", " \u0000 javascript:alert(5)"];
    for (const ruim of ruins) {
      const out = renderPagina({
        ...base,
        secoes: [
          sec("hero_video", { title: "t", ctaText: "go", ctaLink: ruim, videoUrl: ruim, backgroundImage: ruim }),
          sec("hero_lead", { title: "t", ctaText: "go", formAction: ruim, ctaLink: ruim }),
          sec("location", { title: "t", address: "x", mapUrl: ruim }),
        ],
      })["index.html"];
      expect(out.toLowerCase()).not.toMatch(/script:/);
      expect(out).not.toMatch(/java\s*script/i);
      expect(out).not.toContain("data:");
      expect(out).not.toContain("<iframe");
    }
  });

  it("mantém links legítimos", () => {
    const out = renderPagina({ ...base, secoes: [sec("hero", { title: "t", ctaText: "go", ctaLink: "https://wa.me/5585999990000" }), sec("cta", { title: "t", ctaText: "x", ctaLink: "tel:+5585999990000" }), sec("location", { title: "t", address: "x", mapUrl: "https://www.google.com/maps/embed?pb=1" })] })["index.html"];
    expect(out).toContain('href="https://wa.me/5585999990000"');
    expect(out).toContain('href="tel:+5585999990000"');
    expect(out).toContain("<iframe");
  });

  it("não usa classes Tailwind nem estilo inline vindo do usuário", () => {
    const todo = renderPagina({
      ...base,
      secoes: TIPOS_SECAO.map((t, i) => sec(t, PROPS_MINIMAS[t], `s${i}`)),
    })["index.html"];
    const classes = [...todo.matchAll(/class="([^"]*)"/g)].map((m) => m[1]).join(" ");
    expect(classes).not.toMatch(/\b(bg|text|px|py)-/);
    expect(todo).not.toMatch(/\sstyle="/);
    for (const c of classes.split(/\s+/).filter(Boolean)) expect(c.startsWith("z-")).toBe(true);
  });

  it("todas as classes z-* usadas existem em secoes.css", () => {
    const todo = renderPagina({
      ...base,
      secoes: TIPOS_SECAO.map((t, i) => sec(t, { ...PROPS_MINIMAS[t], image: "a.png", backgroundImage: "b.png", mapUrl: "https://example.com/m", formAction: "https://example.com/f", videoUrl: "https://example.com/v", stats: [{ valor: "1", rotulo: "x" }], bullets: ["a"], nota: "n", eyebrow: "e", ctaSecondaryText: "s" }, `s${i}`)),
    })["index.html"];
    const usadas = new Set([...todo.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));
    const css = readFileSync(join(process.cwd(), "lib/octa/secoes/secoes.css"), "utf8");
    const faltando = [...usadas].filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css));
    expect(faltando).toEqual([]);
  });

  it("usa os ids das seções como âncora e marca o primeiro contato", () => {
    const out = renderPagina({ ...base, secoes: [sec("hero", PROPS_MINIMAS.hero, "topo"), sec("cta", PROPS_MINIMAS.cta, "fim")] })["index.html"];
    expect(out).toContain('id="topo"');
    expect(out).toContain('id="contato"');
    const ruim = renderPagina({ ...base, secoes: [sec("hero", PROPS_MINIMAS.hero, 'x" onload="1')] })["index.html"];
    expect(ruim).not.toContain('onload="1"');
  });

  it("tipo desconhecido passado direto ao renderPagina é ignorado, sem lançar", () => {
    expect(() => renderPagina({ ...base, secoes: [sec("nao_existe")] })).not.toThrow();
  });

  it("marcaProibida: lança se o nome da marca aparecer em qualquer lugar da página", () => {
    expect(() => renderPagina({ ...base, marcaProibida: "Linear", secoes: [sec("hero", { title: "Feito com LINEAR" })] })).toThrow(/marca/i);
    expect(() => renderPagina({ ...base, marcaProibida: "Linear", secoes: [sec("hero", { title: "Olá" })] })).not.toThrow();
  });
});

describe("fontes (Google Fonts)", () => {
  const com = (titulo: string, corpo: string): TokensDesign => ({ ...TOKENS_PADRAO, fontes: { titulo, corpo } });
  const sistema = 'system-ui, "Segoe UI", Roboto, sans-serif';

  it("liga preconnect + stylesheet das famílias do Google Fonts", () => {
    const html = renderPagina({ ...base, secoes: [], tokens: com(`"Space Grotesk", ${sistema}`, `"Inter", ${sistema}`) })["index.html"];
    expect(html).toContain('<link rel="preconnect" href="https://fonts.googleapis.com">');
    expect(html).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
    expect(html).toMatch(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Space\+Grotesk:wght@400;700&amp;family=Inter:wght@400;700&amp;display=swap">/);
  });

  it("pilha de sistema não gera link nenhum; família repetida entra uma vez; fonte de peso único não pede wght", () => {
    const so = renderPagina({ ...base, secoes: [] })["index.html"];
    expect(so).not.toContain("fonts.googleapis.com");
    expect(so).not.toContain("fonts.gstatic.com");
    const igual = renderPagina({ ...base, secoes: [], tokens: com(`"Inter", ${sistema}`, `"Inter", ${sistema}`) })["index.html"];
    expect(igual.match(/family=Inter/g)?.length).toBe(1);
    const unico = renderPagina({ ...base, secoes: [], tokens: com(`"Instrument Serif", ${sistema}`, sistema) })["index.html"];
    expect(unico).toContain("family=Instrument+Serif&amp;display=swap");
  });

  it("Georgia/Arial (aberta, mas de sistema) não vão pro Google", () => {
    const html = renderPagina({ ...base, secoes: [], tokens: com('"Georgia", serif', '"Arial", sans-serif') })["index.html"];
    expect(html).not.toContain("fonts.googleapis.com");
  });
});

describe("um teste por tipo", () => {
  it("são 39 tipos, sem hero_gradient", () => {
    expect(TIPOS_SECAO.length).toBe(39);
    expect(new Set(TIPOS_SECAO).size).toBe(39);
    expect(TIPOS_SECAO).not.toContain("hero_gradient" as never);
  });

  for (const t of TIPOS_SECAO) {
    it(`${t} renderiza com as props mínimas e sem props`, () => {
      const com = renderPagina({ ...base, secoes: [sec(t, PROPS_MINIMAS[t])] })["index.html"];
      expect(com).toMatch(/<main[^>]*>\s*<[a-z]/);
      expect(com).toContain("z-");
      expect(() => renderPagina({ ...base, secoes: [sec(t, {})] })).not.toThrow();
    });
  }
});

describe("validarSecoes", () => {
  it("descarta tipo desconhecido, lixo e hero_gradient", () => {
    const r = validarSecoes([
      { id: "a", type: "hero", props: { title: "ok" } },
      { id: "b", type: "hero_gradient", props: {} },
      { id: "c", type: "nada", props: {} },
      "texto",
      null,
    ]);
    expect(r.map((s) => s.type)).toEqual(["hero"]);
  });

  it("descarta props que não são texto onde devia ser, e as desconhecidas", () => {
    const [s] = validarSecoes([{ id: "a", type: "hero", props: { title: 42, subtitle: "ok", ctaText: { a: 1 }, estranha: "x", __proto__: { x: 1 } } }]);
    expect(s.props).toEqual({ subtitle: "ok" });
  });

  it("filtra itens malformados e limita rating a 1–5", () => {
    const [s] = validarSecoes([{ id: "a", type: "reviews", props: { items: [{ name: "A", content: 3, rating: 9 }, { name: "B", rating: 4 }, "x", null] } }]);
    expect(s.props.items).toEqual([{ name: "A" }, { name: "B", rating: 4 }]);
  });

  it("gera id quando falta e devolve [] para entrada que não é lista", () => {
    expect(validarSecoes([{ type: "cta", props: {} }])[0].id).toBe("s1");
    expect(validarSecoes({ a: 1 })).toEqual([]);
    expect(validarSecoes(undefined)).toEqual([]);
  });
});

describe("VARIANTES_POR_CLIMA", () => {
  it("só referencia tipos válidos e cobre os climas do índice", () => {
    for (const lista of Object.values(VARIANTES_POR_CLIMA)) for (const t of lista) expect(TIPOS_SECAO).toContain(t);
    const climas = new Set(carregarIndice().flatMap((e) => e.clima));
    for (const c of climas) expect(VARIANTES_POR_CLIMA[c], `clima ${c}`).toBeTruthy();
  });
});

describe("com tokens reais do índice", () => {
  it("renderiza a página inteira com 6 estilos sem lançar e sem a marca de origem", () => {
    const ind = carregarIndice();
    for (const e of ind.filter((_, i) => i % 14 === 0)) {
      const out = renderPagina({
        ...base,
        tokens: e.tokens,
        marcaProibida: e.marca,
        secoes: TIPOS_SECAO.map((t, i) => sec(t, PROPS_MINIMAS[t], `s${i}`)),
      });
      expect(out["styles.css"].startsWith(":root{")).toBe(true);
    }
  });
});
