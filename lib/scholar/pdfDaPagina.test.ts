import { describe, it, expect } from "vitest";
import { pdfDaPagina, pdfDoArxiv } from "./pdfDaPagina";

describe("pdfDaPagina (#414)", () => {
  it("lê o citation_pdf_url (relativo vira absoluto, &amp; desescapado)", () => {
    const html = `<html><head><title>x</title><meta name="citation_title" content="T"><meta name="citation_pdf_url" content="/doi/pdf/10.1/abc?download=1&amp;v=2"></head>`;
    expect(pdfDaPagina(html, "https://revista.org/doi/10.1/abc")).toBe("https://revista.org/doi/pdf/10.1/abc?download=1&v=2");
  });
  it("aspas simples, ordem invertida dos atributos e o <link rel=alternate type=application/pdf>", () => {
    expect(pdfDaPagina(`<meta content='https://x.org/a.pdf' name='citation_pdf_url'>`, "https://x.org/a")).toBe("https://x.org/a.pdf");
    expect(pdfDaPagina(`<link rel="alternate" type="application/pdf" href="/files/b.pdf">`, "https://y.org/art/1")).toBe("https://y.org/files/b.pdf");
  });
  it("página sem PDF anunciado, ou com esquema perigoso → null", () => {
    expect(pdfDaPagina("<html><head><meta name='description' content='oi'></head></html>", "https://z.org")).toBeNull();
    expect(pdfDaPagina(`<meta name="citation_pdf_url" content="javascript:alert(1)">`, "https://z.org")).toBeNull();
  });
});

describe("pdfDoArxiv (#414)", () => {
  it("/abs/<id> vira /pdf/<id>; outros endereços não", () => {
    expect(pdfDoArxiv("https://arxiv.org/abs/2401.00001v2")).toBe("https://arxiv.org/pdf/2401.00001v2");
    expect(pdfDoArxiv("https://export.arxiv.org/abs/hep-th/9901001")).toBe("https://export.arxiv.org/pdf/hep-th/9901001");
    expect(pdfDoArxiv("https://arxiv.org/pdf/2401.00001")).toBeNull();
    expect(pdfDoArxiv("https://notarxiv.org/abs/1")).toBeNull();
  });
});
