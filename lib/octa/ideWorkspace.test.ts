import { describe, it, expect } from "vitest";
import { arvore, aplicarEdicoes, fecharAba, abrir, caminhoValido, linguagem, PROJETO_INICIAL } from "./ideWorkspace";

describe("octa · workspace da IDE", () => {
  it("árvore: pastas primeiro, ordem alfabética", () => {
    const t = arvore({ "b.py": "", "src/z.ts": "", "src/a.ts": "", "a.md": "" });
    expect(t.map((n) => n.nome)).toEqual(["src", "a.md", "b.py"]);
    expect(t[0].filhos.map((n) => n.caminho)).toEqual(["src/a.ts", "src/z.ts"]);
  });
  it("aplica edições do agente: arquivo novo abre em aba, apagado some das abas", () => {
    const e = aplicarEdicoes(PROJETO_INICIAL, { "main.py": "ok", "tests/test_soma.py": "t" }, ["index.html"]);
    expect(e.arquivos["main.py"]).toBe("ok");
    expect("index.html" in e.arquivos).toBe(false);
    expect(e.abertos).toEqual(["main.py", "tests/test_soma.py"]);
    expect(e.ativo).toBe("main.py");
  });
  it("abas: abrir e fechar mantém um ativo coerente", () => {
    let e = abrir(PROJETO_INICIAL, "README.md");
    expect(e.ativo).toBe("README.md");
    e = fecharAba(e, "README.md");
    expect(e.ativo).toBe("main.py");
    expect(fecharAba(e, "main.py").ativo).toBeNull();
  });
  it("caminho e linguagem", () => {
    expect(caminhoValido("./src/a.ts")).toBe("src/a.ts");
    expect(caminhoValido("../x")).toBeNull();
    expect(caminhoValido("src/")).toBeNull();
    expect(linguagem("x.py")).toEqual({ monaco: "python", runner: "python" });
    expect(linguagem("x.weird").monaco).toBe("plaintext");
  });
});

describe("octa · #421 · SVG abre como imagem", () => {
  it("reconhece .svg (qualquer caixa), e só ele", async () => {
    const { ehSvg } = await import("./ideWorkspace");
    expect(ehSvg("arte/soma.svg")).toBe(true);
    expect(ehSvg("ARTE/Soma.SVG")).toBe(true);
    expect(ehSvg(" arte/x.svg ")).toBe(true);
    expect(ehSvg("index.html")).toBe(false);
    expect(ehSvg("svg.py")).toBe(false);
    expect(ehSvg("arte/soma.svg.bak")).toBe(false);
    expect(ehSvg(null)).toBe(false);
    expect(ehSvg("")).toBe(false);
  });

  it("SVG vira data URL de imagem, com o conteúdo codificado", async () => {
    const { svgParaDataUrl } = await import("./ideWorkspace");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#1a0b07"/></svg>';
    const url = svgParaDataUrl(svg)!;
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(url.split(",").slice(1).join(","))).toBe(svg);
    expect(url).not.toContain("#"); // o # da cor iria quebrar a URL se não fosse codificado
  });

  it("aceita o cabeçalho <?xml …?> antes do <svg>", async () => {
    const { svgParaDataUrl } = await import("./ideWorkspace");
    expect(svgParaDataUrl('<?xml version="1.0"?>\n<svg viewBox="0 0 1 1"></svg>')).not.toBeNull();
  });

  it("vazio ou sem <svg> → null (a tela mostra o aviso de erro)", async () => {
    const { svgParaDataUrl } = await import("./ideWorkspace");
    expect(svgParaDataUrl("")).toBeNull();
    expect(svgParaDataUrl("   ")).toBeNull();
    expect(svgParaDataUrl(null)).toBeNull();
    expect(svgParaDataUrl("<div>não é svg</div>")).toBeNull();
    expect(svgParaDataUrl("<svgx></svgx>")).toBeNull();
  });

  it("o .svg continua editável como código (xml) e sem 'Rodar'", async () => {
    const { linguagem } = await import("./ideWorkspace");
    expect(linguagem("arte/soma.svg")).toEqual({ monaco: "xml", runner: null });
  });
});

describe("octa · #421 · revisão: arte recriada com o mesmo nome abre como imagem", () => {
  it("esquece a escolha 'Código' dos caminhos apagados/regravados e mantém o resto", async () => {
    const { esquecerVerCodigo } = await import("./ideWorkspace");
    const pref = { "arte/soma.svg": true, "arte/outra.svg": true };
    expect(esquecerVerCodigo(pref, ["arte/soma.svg"])).toEqual({ "arte/outra.svg": true });
    expect(pref).toEqual({ "arte/soma.svg": true, "arte/outra.svg": true }); // não muta o original
  });
  it("nada a esquecer → devolve o MESMO objeto (sem re-render à toa)", async () => {
    const { esquecerVerCodigo } = await import("./ideWorkspace");
    const pref = { "arte/outra.svg": true };
    expect(esquecerVerCodigo(pref, ["arte/soma.svg", "main.py"])).toBe(pref);
    expect(esquecerVerCodigo(pref, [])).toBe(pref);
  });
});
