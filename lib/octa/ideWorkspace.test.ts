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
