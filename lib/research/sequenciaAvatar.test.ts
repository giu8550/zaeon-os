import { describe, it, expect } from "vitest";
import { DURACAO, envelope, sequenciaEm } from "./sequenciaAvatar";

describe("o roteiro da avatar enquanto a resposta é gerada", () => {
  it("começa pensando (os olhos), depois busca na rede", () => {
    expect(sequenciaEm(0.5).seq).toBe("pensar");
    expect(sequenciaEm(DURACAO.pensar + 0.1).seq).toBe("buscar");
  });
  it("depois da busca vem a árvore; no ciclo seguinte, o cérebro — e o laço continua", () => {
    const p = DURACAO.pensar, volta = DURACAO.buscar + DURACAO.arvore;
    expect(sequenciaEm(p + DURACAO.buscar + 0.1).seq).toBe("arvore");
    expect(sequenciaEm(p + volta + 0.1).seq).toBe("buscar");
    expect(sequenciaEm(p + volta + DURACAO.buscar + 0.1).seq).toBe("cerebro");
    expect(sequenciaEm(p + 2 * volta + DURACAO.buscar + 0.1).seq).toBe("arvore");
  });
  it("o progresso fica entre 0 e 1 e o envelope entra e sai suave", () => {
    for (let t = 0; t < 60; t += 0.37) { const { u } = sequenciaEm(t); expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThanOrEqual(1); }
    expect(envelope(0)).toBe(0); expect(envelope(0.5)).toBe(1); expect(envelope(1)).toBe(0);
  });
});
