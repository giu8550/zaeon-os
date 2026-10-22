import { describe, it, expect } from "vitest";
import { MAX_NOMES_NO_CONTEXTO, contextoDoLote, rotuloDoLote } from "./loteAnexos";

const lote = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nome: `Apostila ${i + 1}` }));

describe("vários anexos na conversa", () => {
  it("sem lote: nada no contexto nem no balão", () => {
    expect(contextoDoLote([])).toBe("");
    expect(rotuloDoLote([])).toBeUndefined();
  });
  it("o contexto leva os nomes (por referência) e a regra de responder pela base", () => {
    const c = contextoDoLote(lote(3));
    expect(c).toContain('anexou 3 arquivos');
    expect(c).toContain('"Apostila 1"; "Apostila 2"; "Apostila 3"');
    expect(c).toContain("base");
  });
  it("pasta grande: teto de nomes + 'e mais N'; aspas do nome não quebram a frase", () => {
    const c = contextoDoLote(lote(MAX_NOMES_NO_CONTEXTO + 5));
    expect(c).toContain("e mais 5");
    expect(c).not.toContain(`Apostila ${MAX_NOMES_NO_CONTEXTO + 1}"`);
    expect(contextoDoLote([{ id: "x", nome: 'Cap "1"' }])).toContain(`"Cap '1'"`);
  });
  it("balão: 1 nome, ou contagem com os 3 primeiros", () => {
    expect(rotuloDoLote(lote(1))).toBe("Apostila 1");
    expect(rotuloDoLote(lote(5))).toBe("5 arquivos: Apostila 1, Apostila 2, Apostila 3…");
  });
});
