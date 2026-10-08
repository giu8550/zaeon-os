import { describe, expect, it } from "vitest";
import { ASAS, ASAS_INICIO, modoDasAsas, passoAsas, sintetizarAbrirAsas, sintetizarBaterAsa, sintetizarFecharAsas, sintetizarVentoAsas, ventoDasAsas, type EntradaAsas } from "./asas";
import { SINTESE, SONS } from "./audio";

const rodar = (i: EntradaAsas, seg: number, e = ASAS_INICIO) => { const ev = { bateu: 0, abriu: 0, fechou: 0 }; let s = { e } as ReturnType<typeof passoAsas>; for (let k = 0; k < seg * 60; k++) { s = passoAsas(s.e, i, 1 / 60); ev.bateu += +s.bateu; ev.abriu += +s.abriu; ev.fechou += +s.fechou; } return { s, ev }; };

describe("as asas negras do founder (estado)", () => {
  it("o modo vem do voo: chão, subindo, pra frente, planando, mergulho", () => {
    expect(modoDasAsas({ noAr: false, empuxo: 0, vy: 0, movendo: true })).toBe("chao");
    expect(modoDasAsas({ noAr: true, empuxo: 1, vy: 4, movendo: false })).toBe("sobe");
    expect(modoDasAsas({ noAr: true, empuxo: 0.9, vy: 0, movendo: true })).toBe("frente");
    expect(modoDasAsas({ noAr: true, empuxo: 0.35, vy: -2, movendo: false })).toBe("plana");
    expect(modoDasAsas({ noAr: true, empuxo: 0.3, vy: -12, movendo: false })).toBe("mergulho");
  });
  it("no chão ficam ABERTAS (imponentes) e não batem; subindo batem ~2,6×/s (cada descida = um som)", () => {
    const chao = rodar({ noAr: false, empuxo: 0, vy: 0, movendo: false }, 2);
    expect(chao.s.e.abertura).toBeGreaterThan(0.99); expect(chao.ev.bateu).toBe(0);
    const sobe = rodar({ noAr: true, empuxo: 1, vy: 5, movendo: false }, 3);
    expect(sobe.s.e.abertura).toBeGreaterThan(0.99); expect(sobe.ev.abriu).toBe(1);
    expect(sobe.ev.bateu).toBeGreaterThanOrEqual(5); expect(sobe.ev.bateu).toBeLessThanOrEqual(ASAS.sobe.freq * 3 + 1);
  });
  it("planando quase não batem (sem som de batida); pousar dá 1 evento e elas continuam abertas", () => {
    const voo = rodar({ noAr: true, empuxo: 1, vy: 5, movendo: false }, 2).s.e;
    const plana = rodar({ noAr: true, empuxo: 0.35, vy: -2, movendo: false }, 4, voo);
    expect(plana.s.e.amp).toBeLessThan(ASAS.ampSom); expect(plana.ev.bateu).toBeLessThanOrEqual(1);
    const pousa = rodar({ noAr: false, empuxo: 0, vy: 0, movendo: false }, 2, plana.s.e);
    expect(pousa.ev.fechou).toBe(1); expect(pousa.s.e.abertura).toBeGreaterThan(0.99);
    const mergulho = rodar({ noAr: true, empuxo: 0.3, vy: -12, movendo: false }, 2, voo);
    expect(mergulho.s.e.abertura).toBeLessThan(0.6);   // só o mergulho fecha um pouco
  });
  it("o vento: nada no chão, alto planando e no mergulho", () => {
    expect(ventoDasAsas("chao", 10)).toBe(0); expect(ventoDasAsas("plana", 10)).toBeGreaterThan(ventoDasAsas("sobe", 10)); expect(ventoDasAsas("mergulho", 0)).toBeGreaterThan(0.8);
  });
});

describe("os sons das asas (sintetizados)", () => {
  it("existem na tabela, com duração certa e sem clique no fim (one-shots)", () => {
    for (const n of ["asa-bater", "asa-vento", "asa-abrir", "asa-fechar"] as const) { expect(SONS[n].sintetico).toBe(true); expect(SINTESE[n]).toBeTypeOf("function"); }
    expect(SONS["asa-vento"].loop).toBe(true); expect(SONS["asa-bater"].loop).toBe(false);
    const sr = 8000;
    for (const [f, seg] of [[sintetizarBaterAsa, 0.45], [sintetizarAbrirAsas, 0.8], [sintetizarFecharAsas, 0.5]] as const) {
      const x = f(sr); expect(x.length).toBe(Math.round(sr * seg)); expect(Math.abs(x[x.length - 1]!)).toBeLessThan(0.01);
      expect(Math.max(...Array.from(x, Math.abs))).toBeGreaterThan(0.5);
    }
    const v = sintetizarVentoAsas(sr); expect(v.length).toBe(sr * 3);
  });
});
