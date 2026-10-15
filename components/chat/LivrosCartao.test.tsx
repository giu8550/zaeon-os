// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";

const salvos: any[] = [];
vi.mock("@/lib/useLibraryFiles", () => ({ useLibraryFiles: () => ({ save: async (f: any) => { salvos.push(f); return f; } }) }));

import LivrosCartao, { idDoLivro, livroParaArquivo, linhaDoLivro } from "./LivrosCartao";
import { EVT_ABRIR_DOC } from "@/lib/chat/documentos";
import { semListaDeLivros, markdownDosLivros } from "@/lib/livros/busca";

afterEach(() => { cleanup(); salvos.length = 0; });

const DOM = { titulo: "Dom Casmurro", autores: ["Machado de Assis"], ano: 1899, acesso: "pdf_livre", pdfUrl: "https://archive.org/download/dc/dc.pdf", lerUrl: null, paginaUrl: "https://openlibrary.org/works/OL1W", fonte: "openlibrary", licenca: "domínio público" };
const SAP = { titulo: "Sapiens", autores: ["Yuval Noah Harari"], ano: 2011, acesso: "emprestimo", pdfUrl: null, lerUrl: "https://openlibrary.org/works/OL2W/borrow", paginaUrl: "https://openlibrary.org/works/OL2W", fonte: "openlibrary", licenca: null };

describe("LivrosCartao", () => {
  it("PDF livre: 'Abrir no leitor' guarda na biblioteca e abre a aba de documento (pdf) na sala", async () => {
    const abertos: any[] = [];
    const on = (e: Event) => abertos.push((e as CustomEvent).detail);
    window.addEventListener(EVT_ABRIR_DOC, on);
    const { getByText } = render(<LivrosCartao livros={[DOM]} sala="estudos" />);
    fireEvent.click(getByText("Abrir no leitor"));
    await waitFor(() => expect(abertos).toHaveLength(1));
    window.removeEventListener(EVT_ABRIR_DOC, on);
    expect(salvos[0]).toMatchObject({ id: idDoLivro(DOM), title: "Dom Casmurro", pdfUrl: DOM.pdfUrl, year: 1899 });
    expect(abertos[0]).toMatchObject({ sala: "estudos", studioKind: "pdf", artifactId: idDoLivro(DOM), focar: true, data: { file: { pdfUrl: DOM.pdfUrl } } });
    expect(getByText("Aberto no leitor")).toBeTruthy();
  });
  it("sem PDF: sem botão de leitor; ação certa por acesso (empréstimo)", () => {
    const { queryByText, getByText } = render(<LivrosCartao livros={[SAP]} sala="pesquisa" />);
    expect(queryByText("Abrir no leitor")).toBeNull();
    expect(getByText("Pegar emprestado").closest("a")?.getAttribute("href")).toBe(SAP.lerUrl);
  });
  it("puros: id estável e só PDF vira arquivo da biblioteca", () => {
    expect(idDoLivro(DOM)).toBe(idDoLivro({ ...DOM }));
    expect(livroParaArquivo(SAP)).toBeNull();
    expect(linhaDoLivro({ ...DOM, autores: ["OpenStax"], fonte: "openstax", licenca: "CC BY 4.0", ano: 2016 })).toBe("OpenStax · 2016 · PDF livre · CC BY 4.0");
  });
  it("semListaDeLivros corta a lista em markdown (o cartão entra no lugar)", () => {
    const texto = `Achei a edição em domínio público.\n\n${markdownDosLivros([{ ...DOM, idiomas: [], fonte: "openlibrary", acesso: "pdf_livre" } as any])}`;
    expect(semListaDeLivros(texto)).toBe("Achei a edição em domínio público.");
    expect(semListaDeLivros("sem lista")).toBe("sem lista");
  });
});
