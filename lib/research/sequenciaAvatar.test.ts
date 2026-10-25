import { describe, it, expect } from "vitest";
import { DURACAO, NIVEL, envelope, sequenciaEm } from "./sequenciaAvatar";

describe("o roteiro da avatar enquanto a resposta é gerada", () => {
  it("uma resposta rápida: pensa e raspa a página (a aranha se alimentando das telas)", () => {
    expect(sequenciaEm(0.5).seq).toBe("pensar");
    expect(sequenciaEm(2).seq).toBe("raspar");
    expect(sequenciaEm(4.9).seq).toBe("raspar");
  });
  it("passou de 5 s: a aranha vira energia e os raios aparecem", () => {
    expect(sequenciaEm(NIVEL.energia + 0.1).seq).toBe("energia");
    expect(sequenciaEm(NIVEL.holo - 0.1).seq).toBe("energia");
  });
  it("numa resposta longa: um laço de poderes cósmicos (árvore → telepatia → energia → leitura → feitiço → cérebro → energia)", () => {
    const t0 = NIVEL.holo + 0.1;
    const ordem: (keyof typeof DURACAO)[] = ["arvore", "telepatia", "telecinese", "energia", "leitura", "constelacao", "feitico", "portal", "cerebro", "energia"];
    let acc = t0;
    for (const seq of ordem) { expect(sequenciaEm(acc).seq).toBe(seq); acc += DURACAO[seq]; }
    // fechou a volta → recomeça na árvore
    expect(sequenciaEm(acc).seq).toBe("arvore");
  });
  it("o progresso fica entre 0 e 1, cada bloco tem o seu número, e o envelope entra e sai suave", () => {
    for (let t = 0; t < 80; t += 0.37) { const { u } = sequenciaEm(t); expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThanOrEqual(1); }
    expect(sequenciaEm(NIVEL.holo + 0.1).ciclo).not.toBe(sequenciaEm(NIVEL.holo + DURACAO.arvore + 0.1).ciclo);
    expect(envelope(0)).toBe(0); expect(envelope(0.5)).toBe(1); expect(envelope(1)).toBe(0);
  });
});
