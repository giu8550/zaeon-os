// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, render, screen, fireEvent, act, cleanup } from "@testing-library/react";

vi.mock("@/lib/useLibraryFiles", () => ({ useLibraryFiles: () => ({ saveFile: vi.fn(async () => undefined), files: [] }) }));
vi.mock("@/lib/pdfStore", () => ({ blobParaDataUrl: vi.fn(async () => "data:application/pdf;base64,AA==") }));
vi.mock("@/lib/chat/enviarBase", () => ({ enviarLote: vi.fn(async () => []) }));

import { ChipsLote, useAnexoChat } from "./useAnexoChat";

const pdf = (nome: string) => new File(["%PDF"], `${nome}.pdf`, { type: "application/pdf" });
const abrir = () => renderHook(() => useAnexoChat("estudos", { focar: () => undefined, perguntar: () => undefined }));

afterEach(cleanup);

describe("vários anexos visíveis", () => {
  it("1 PDF = chip de leitura inteira; nada no lote", async () => {
    const { result } = abrir();
    await act(async () => { await result.current.anexarArquivos([pdf("Apostila")]); });
    expect(result.current.anexo?.nome).toBe("Apostila");
    expect(result.current.lote).toEqual([]);
  });
  it("2 PDFs = um chip por arquivo; o 3º entra no lote (e o chip único vira parte dele)", async () => {
    const { result } = abrir();
    await act(async () => { await result.current.anexarArquivos([pdf("A")]); });
    await act(async () => { await result.current.anexarArquivos([pdf("B"), pdf("C")]); });
    expect(result.current.anexo).toBeNull();
    expect(result.current.lote.map((a) => a.nome)).toEqual(["A", "B", "C"]);
    await act(async () => { await result.current.anexarArquivos([pdf("D")]); });
    expect(result.current.lote.map((a) => a.nome)).toEqual(["A", "B", "C", "D"]);
    act(() => result.current.tirarDoLote(result.current.lote[1].id));
    expect(result.current.lote.map((a) => a.nome)).toEqual(["A", "C", "D"]);
    act(() => result.current.tirarDoLote());
    expect(result.current.lote).toEqual([]);
  });
  it("ChipsLote mostra cada arquivo com o próprio ×", () => {
    const tirar = vi.fn();
    render(<ChipsLote lote={[{ id: "1", nome: "A" }, { id: "2", nome: "B" }]} onTirar={tirar} />);
    expect(screen.getByText("A")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Tirar B da conversa"));
    expect(tirar).toHaveBeenCalledWith("2");
  });
});

describe("avisoPdfNaoAbriu (#414)", () => {
  it("PDF da web que não abriu: diz o que houve e dá o link do site; upload local: pede pra soltar de novo", async () => {
    const { avisoPdfNaoAbriu } = await import("./useAnexoChat");
    const web = avisoPdfNaoAbriu("Artigo X.pdf", "https://revista.org/art/1");
    expect(web).toContain("**Artigo X**");
    expect(web).toContain("[site original](https://revista.org/art/1)");
    const local = avisoPdfNaoAbriu("Meu PDF", "blob:abc");
    expect(local).not.toContain("](");
    expect(local).toContain("Solte o PDF de novo");
  });
});
