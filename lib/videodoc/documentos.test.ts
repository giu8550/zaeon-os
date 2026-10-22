import { describe, expect, it } from "vitest";
import { chaveDocumento, documentoPublico, documentosDaResposta, juntarDocumentos, marcarBase, temFonteDeTexto } from "./documentos";
import type { Documento } from "@/lib/blueprint/tipos";

describe("os documentos do estudo — o que a conversa citou e o que é da pessoa", () => {
  it("coleta artigos, livros com PDF, base e o trabalho, sem repetir", () => {
    const ds = documentosDaResposta({
      sources: [{ title: "Zether", url: "https://doi.org/10.1007/978-3-030-51280-4_23" }],
      evidencia: [{ claim: "c", source: { title: "Zether (de novo)", url: "https://doi.org/10.1007/978-3-030-51280-4_23" } }],
      livros: [{ titulo: "Cripto", autores: [], ano: null, acesso: "pdf", pdfUrl: "https://x.org/c.pdf", lerUrl: null, paginaUrl: "https://x.org", fonte: "OL", licenca: null }, { titulo: "Sem PDF", autores: [], ano: null, acesso: "", pdfUrl: null, lerUrl: null, paginaUrl: "https://y.org", fonte: "OL", licenca: null }],
      fontesBase: [{ documentoId: "abc", titulo: "Minha apostila", paginas: "3" }],
      tcc: { workId: "w1", titulo: "TCC privacidade", criado: true, alteradas: 1 },
    });
    expect(ds.map((d) => [d.tipo, d.titulo])).toEqual([["artigo", "Zether"], ["livro", "Cripto"], ["base", "Minha apostila"], ["trabalho", "TCC privacidade"]]);
    expect(new Set(ds.map((d) => d.id)).size).toBe(4);
  });
  it("a chave reconhece o DOI em URLs diferentes e decide o compartilhamento", () => {
    expect(chaveDocumento({ tipo: "artigo", url: "https://doi.org/10.1007/ABC" })).toBe("doi:10.1007/abc");
    expect(chaveDocumento({ tipo: "artigo", url: "https://www.arxiv.org/abs/1/" })).toBe("url:arxiv.org/abs/1");
    expect(documentoPublico({ tipo: "artigo", url: "https://doi.org/10.1007/x" })).toBe(true);
    expect(documentoPublico({ tipo: "base", ref: "abc" })).toBe(false);
    // o DOI só vale do doi.org (cache de vídeo público não se envenena por query string)
    expect(chaveDocumento({ tipo: "artigo", url: "https://evil.tld/a.pdf?doi.org/10.1038/nature12373" })).not.toContain("doi:");
    expect(documentoPublico({ tipo: "artigo", url: "https://evil.tld/a.pdf?doi.org/10.1038/nature12373" })).toBe(false);
    expect(documentoPublico({ tipo: "artigo", url: "https://arxiv.org/pdf/1.pdf" })).toBe(false);
  });
  it("juntar mantém base e vídeo dos que já existiam", () => {
    const velho: Documento = { id: "d1", titulo: "Zether", tipo: "artigo", url: "https://doi.org/10.1/x", base: true, videoId: "a".repeat(24) };
    const novo = documentosDaResposta({ sources: [{ title: "Zether", url: "https://doi.org/10.1/x" }, { title: "Outro", url: "https://o.org/p" }] });
    const r = juntarDocumentos([velho], novo);
    expect(r).toHaveLength(2); expect(r[0]).toEqual(velho);
  });
  it("a Zaeon escolhe até 3 base; quem tem vídeo nunca deixa de ser base", () => {
    const ds: Documento[] = ["a", "b", "c", "d", "e"].map((id) => ({ id, titulo: id, tipo: "artigo", base: false }));
    ds[4] = { ...ds[4]!, videoId: "b".repeat(24) };
    const r = marcarBase(ds, ["a", "b", "c", "d"]);
    expect(r.filter((d) => d.base).map((d) => d.id)).toEqual(["a", "b", "c", "e"]);
  });
});

describe("temFonteDeTexto", () => {
  it("DOI, PDF por URL, base e trabalho sim; página web solta não (nem cria o vídeo)", () => {
    expect(temFonteDeTexto({ tipo: "artigo", url: "https://doi.org/10.1007/x" })).toBe(true);
    expect(temFonteDeTexto({ tipo: "livro", url: "https://x.org/livro.pdf" })).toBe(true);
    expect(temFonteDeTexto({ tipo: "artigo", url: "https://blog.example.org/post" })).toBe(false);
    expect(temFonteDeTexto({ tipo: "base", ref: "r1" })).toBe(true);
  });
});
