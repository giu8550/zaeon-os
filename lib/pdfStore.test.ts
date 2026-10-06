import { describe, expect, it } from "vitest";
import { dataUrlParaBlob, idDaUrlIdb, urlIdb } from "./pdfStore";

describe("pdfStore (PDFs do aluno no IndexedDB)", () => {
  it("data: URL base64 → Blob com os bytes e o tipo certos", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 oi");
    const b64 = Buffer.from(bytes).toString("base64");
    const blob = dataUrlParaBlob(`data:application/pdf;base64,${b64}`)!;
    expect(blob.type).toBe("application/pdf");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  });
  it("data: inválido → null (não lança)", () => {
    expect(dataUrlParaBlob("http://x/y.pdf")).toBeNull();
  });
  it("idb:<id> ida e volta; outras URLs não são do IndexedDB", () => {
    expect(idDaUrlIdb(urlIdb("pdf-1"))).toBe("pdf-1");
    expect(idDaUrlIdb("https://arxiv.org/pdf/1")).toBeNull();
    expect(idDaUrlIdb("blob:abc")).toBeNull();
  });
});
