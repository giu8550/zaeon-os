import { describe, expect, it } from "vitest";
import { escolherDocumento, pedidoDeVideo } from "./pedido";
import type { Documento } from "@/lib/blueprint/tipos";

describe("pedido de vídeo no chat", () => {
  it("reconhece o pedido", () => {
    for (const p of ["faz um vídeo desse artigo", "Explica esse PDF em vídeo", "quero um video do Zether", "gera uma videoaula sobre o documento", "transforma o meu TCC em vídeo"]) expect(pedidoDeVideo(p), p).toBe(true);
  });
  it("não confunde com conversa sobre vídeo", () => {
    for (const p of ["vi um vídeo ontem sobre isso", "como edito vídeo no premiere?", "o que é Zether?"]) expect(pedidoDeVideo(p), p).toBe(false);
  });
  it("escolhe pelo título citado; senão o mais recente; o anexo vence", () => {
    const docs: Documento[] = [
      { id: "a", titulo: "Zether: Towards Privacy in a Smart Contract World", tipo: "artigo", base: false },
      { id: "b", titulo: "Bulletproofs: Short Proofs for Confidential Transactions", tipo: "artigo", base: false },
    ];
    expect(escolherDocumento("faz um vídeo do zether", docs)!.id).toBe("a");
    expect(escolherDocumento("faz um vídeo desse artigo", docs)!.id).toBe("b");
    const anexo: Documento = { id: "c", titulo: "meu.pdf", tipo: "base", ref: "r", base: false };
    expect(escolherDocumento("vídeo do zether", docs, anexo)!.id).toBe("c");
    expect(escolherDocumento("vídeo", [])).toBeNull();
  });
});
