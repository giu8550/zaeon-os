import { describe, it, expect } from "vitest";
import { arquivosDasEntradas, MAX_ARQUIVOS_SOLTOS, type Entrada } from "./arquivosSoltos";

const arq = (nome: string): Entrada => ({ isFile: true, isDirectory: false, name: nome, file: (ok) => ok(new File(["x"], nome)) });
/** readEntries devolve em pedaços (como o Chrome, 100 por vez) e depois [] */
const pasta = (nome: string, filhos: Entrada[], porVez = 2): Entrada => ({
  isFile: false, isDirectory: true, name: nome,
  createReader: () => {
    let i = 0;
    return { readEntries: (ok) => { const fatia = filhos.slice(i, i + porVez); i += porVez; setTimeout(() => ok(fatia), 0); } };
  },
});

describe("arquivosDasEntradas", () => {
  it("desce em pastas (inclusive subpastas e leitura em pedaços), na ordem", async () => {
    const out = await arquivosDasEntradas([
      arq("solto.pdf"),
      pasta("Biologia", [arq("a.pdf"), pasta("Cap 2", [arq("b.pdf"), arq("c.pdf"), arq("d.pdf")]), arq("e.pdf"), arq("f.pdf")]),
    ]);
    expect(out.map((f) => f.name)).toEqual(["solto.pdf", "a.pdf", "b.pdf", "c.pdf", "d.pdf", "e.pdf", "f.pdf"]);
  });

  it("ignora ocultos (.DS_Store) e para no teto", async () => {
    const muitos = Array.from({ length: MAX_ARQUIVOS_SOLTOS + 20 }, (_, i) => arq(`${i}.pdf`));
    const out = await arquivosDasEntradas([arq(".DS_Store"), pasta("P", muitos, 100)]);
    expect(out).toHaveLength(MAX_ARQUIVOS_SOLTOS);
    expect(out.some((f) => f.name.startsWith("."))).toBe(false);
  });

  it("arquivo ou pasta que falha ao ler é pulado, sem derrubar o resto", async () => {
    const quebrado: Entrada = { isFile: true, isDirectory: false, name: "x.pdf", file: (_ok, erro) => erro?.(new Error("perm")) };
    const pastaRuim: Entrada = { isFile: false, isDirectory: true, name: "R", createReader: () => ({ readEntries: (_ok, erro) => erro?.(new Error("perm")) }) };
    const out = await arquivosDasEntradas([quebrado, pastaRuim, arq("ok.pdf")]);
    expect(out.map((f) => f.name)).toEqual(["ok.pdf"]);
  });
});
