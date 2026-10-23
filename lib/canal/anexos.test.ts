import { describe, it, expect } from "vitest";
import { mensagemComAnexos, separarArquivos, PEDIDO_SO_ANEXO } from "./anexos";

describe("anexos no Escritório", () => {
  it("mensagem leva a linha 📎 com os nomes + o texto (ou o pedido padrão)", () => {
    expect(mensagemComAnexos("  resuma o cap. 2 ", ["livro.pdf", "aula.pdf"])).toBe("📎 livro.pdf, aula.pdf\nresuma o cap. 2");
    expect(mensagemComAnexos("", ["livro.pdf"])).toBe(`📎 livro.pdf\n${PEDIDO_SO_ANEXO}`);
    expect(mensagemComAnexos(" oi ", [])).toBe("oi");
  });
  it("só PDF entra (por tipo ou extensão)", () => {
    const r = separarArquivos([{ name: "a.pdf" }, { name: "b.PDF", type: "" }, { name: "c.png", type: "image/png" }, { name: "d", type: "application/pdf" }]);
    expect(r.pdfs.map((f) => f.name)).toEqual(["a.pdf", "b.PDF", "d"]);
    expect(r.recusados.map((f) => f.name)).toEqual(["c.png"]);
  });
});
