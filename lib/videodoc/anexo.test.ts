import { describe, expect, it } from "vitest";
import { bytesDoPdf, respostaDoVideo } from "./anexo-server";

describe("PDF anexado no chat → vídeo", () => {
  const pdf = Buffer.from("%PDF-1.7 conteúdo").toString("base64");
  it("aceita PDF (data URL ou base64 cru) e recusa imagem ou lixo", () => {
    expect(bytesDoPdf(`data:application/pdf;base64,${pdf}`)).toBeInstanceOf(Uint8Array);
    expect(bytesDoPdf(pdf)).toBeInstanceOf(Uint8Array);
    expect(bytesDoPdf(`data:image/png;base64,${pdf}`)).toBeNull();
    expect(bytesDoPdf(Buffer.from("não é pdf").toString("base64"))).toBeNull();
  });
  it("a resposta leva o card do vídeo, ou o motivo legível", () => {
    expect(respostaDoVideo({ videoId: "a".repeat(24), titulo: "Zether" })).toMatchObject({ videoDoc: { videoId: "a".repeat(24) }, nucleo: expect.stringContaining("Zether") });
    expect(respostaDoVideo({ titulo: "", motivo: "limite_do_dia" }).nucleo).toContain("limite");
  });
});
