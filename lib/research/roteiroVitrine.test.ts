import { describe, it, expect } from "vitest";
import { CICLO, ENTREGAVEIS, FASES, momentoVitrine } from "./roteiroVitrine";
import { sequenciaEm } from "./sequenciaAvatar";

describe("o roteiro da vitrine do hero (pensa → pesquisa → gera → alimenta → descansa)", () => {
  it("as fases vêm na ordem, e o ciclo passa de 22 s (ela gera, descansa e continua)", () => {
    let t = 0.01;
    for (const [fase, d] of FASES) { expect(momentoVitrine(t).fase).toBe(fase); t += d; }
    expect(CICLO).toBeGreaterThan(22);
    expect(momentoVitrine(CICLO + 0.01).fase).toBe("pensar");
  });
  it("cada ciclo é um entregável novo, e a volta passa pelos seis", () => {
    const vistos = ENTREGAVEIS.map((_, i) => momentoVitrine(i * CICLO + 1).entregavel);
    expect(new Set(vistos).size).toBe(ENTREGAVEIS.length);
    expect(momentoVitrine(ENTREGAVEIS.length * CICLO + 1).entregavel).toBe(ENTREGAVEIS[0].id);
  });
  it("reaproveita as cenas da conversa: pensar, raspar/energia na pesquisa, a árvore ao alimentar", () => {
    const em = (fase: string, u: number) => {
      let t = 0; for (const [f, d] of FASES) { if (f === fase) return t + d * u; t += d; } return t;
    };
    expect(sequenciaEm(momentoVitrine(em("pensar", 0.5)).gerandoHa!).seq).toBe("pensar");
    expect(sequenciaEm(momentoVitrine(em("pesquisar", 0.2)).gerandoHa!).seq).toBe("raspar");
    expect(sequenciaEm(momentoVitrine(em("pesquisar", 0.9)).gerandoHa!).seq).toBe("energia");
    expect(sequenciaEm(momentoVitrine(em("alimentar", 0.5)).gerandoHa!).seq).toBe("arvore");
    expect(sequenciaEm(momentoVitrine(em("alimentar", 0.999)).gerandoHa!).seq).toBe("arvore");
    expect(momentoVitrine(em("gerar", 0.5)).gerandoHa).toBeNull();
    expect(momentoVitrine(em("descansar", 0.5)).gerandoHa).toBeNull();
  });
  it("o progresso fica entre 0 e 1", () => {
    for (let t = 0; t < CICLO * 7; t += 0.41) { const { u } = momentoVitrine(t); expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThanOrEqual(1); }
  });
});
