import { describe, expect, it } from "vitest";
import { BOCA_DJ, BURACO_NAVE, CHEGADA_NAVE, CHEGADA_DJ, IDS_NOS, NOS, SALAS_NO, bocaDJMundo, chegadaDJMundo, destinosDe, ehSala, naBocaDJ, naBocaNave, noDoAnel } from "./buracos";
import { CIDADE, TORRE_DJ, alturaNaCidade, colisoresDaCidade, naCabineDJ, naIlhaPrincipal, naTorreDJ, PISO_FESTA, salaEm } from "./ceu";
import { IDS_PLATAFORMAS, andarNaPlataforma } from "./plataformas";
import { PRACA, QUEDA_VAZIO, naPraca } from "./praca";
import { COMODOS, andarNaNave } from "./naveQG";
import { dentroDeAlgum } from "./colisao";
import { MAPA } from "@/lib/lounge3d/sala";

describe("a rede de BURACOS NEGROS (o metrô do hiperespaço sem chão)", () => {
  it("um nó em cada lugar: a Zaeon, a praça, a UNILAB, os 3 campi, a Solana House e as SALAS (os níveis)", () => {
    expect(new Set(IDS_NOS)).toEqual(new Set(["zaeon", "praca", ...IDS_PLATAFORMAS, ...SALAS_NO]));
    expect(IDS_NOS[0]).toBe("zaeon");
    for (const id of IDS_NOS) expect(NOS[id].nome.length).toBeGreaterThan(2);
  });
  it("o anel e a chegada de cada nó ficam em chão FIRME; quem chega aparece fora do anel (não volta a disparar)", () => {
    for (const id of IDS_NOS) {
      const n = NOS[id];
      expect(noDoAnel(n.anel, n.y)).toBe(id);
      expect(noDoAnel(n.chegada, n.y)).toBeNull();
      expect(noDoAnel(n.anel, n.y + 12)).toBeNull();   // só no piso do nó (voando por cima não entra)
      for (const p of [n.anel, n.chegada]) {
        if (id === "zaeon") { expect(naIlhaPrincipal(p)).toBe(true); expect(dentroDeAlgum(p, colisoresDaCidade())).toBe(false); }
        else if (id === "praca") expect(naPraca(p, -2)).toBe(true);
        else if (ehSala(id)) { const l = { x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z }; expect(salaEm(l, 0, true)).toBe(id); }   // (as SALAS: dentro do disco delas)
        else expect(andarNaPlataforma(id, 0, p).fora).toBe(false);
      }
      expect(n.bh.h).toBeGreaterThan(n.bh.r * 2);   // o buraco paira acima da cabeça de quem está no anel
    }
  });
  it("o túnel oferece todos os OUTROS lugares", () => {
    for (const id of IDS_NOS) { const d = destinosDe(id); expect(d).toHaveLength(IDS_NOS.length - 1); expect(d.some((x) => x.id === id)).toBe(false); }
    expect(destinosDe(null)).toHaveLength(IDS_NOS.length);
  });
  it("caiu no vazio: bem abaixo da praça (o piso mais baixo do mapa)", () => {
    expect(QUEDA_VAZIO).toBeLessThan(PRACA.y - 40);
    expect(MAPA.queda).toBeLessThan(QUEDA_VAZIO);   // a presença mostra quem está CAINDO (não trava em 0)
  });
});

describe("o PAR do dono: nave ↔ cabine do DJ (a única entrada da cabine)", () => {
  it("a boca fica NA cabine (no alto da torre), longe do lugar do DJ e do anel de descer", () => {
    const b = bocaDJMundo();
    expect(naBocaDJ(b)).toBe(true); expect(naTorreDJ(b)).toBe(true);
    expect(alturaNaCidade(b)).toBe(PISO_FESTA + TORRE_DJ.topo);
    expect(naCabineDJ(b)).toBe(false);
    expect(Math.hypot(BOCA_DJ.x, BOCA_DJ.z - TORRE_DJ.elevador.desce)).toBeGreaterThan(BOCA_DJ.r + TORRE_DJ.elevador.rDesce + 0.5);
    expect(Math.hypot(BOCA_DJ.x, BOCA_DJ.z - TORRE_DJ.z) + BOCA_DJ.r).toBeLessThan(TORRE_DJ.r);
  });
  it("chegando da nave: na cabine, fora da boca (não volta na hora) e fora do lugar do DJ", () => {
    const c = chegadaDJMundo();
    expect(naBocaDJ(c)).toBe(false); expect(naTorreDJ(c)).toBe(true); expect(naCabineDJ(c)).toBe(false);
    expect(alturaNaCidade(c)).toBe(PISO_FESTA + TORRE_DJ.topo);
    expect(CHEGADA_DJ.z).toBe(TORRE_DJ.elevador.chegaEmCima);
    expect(CIDADE.salas.lounge).toBeDefined();
  });
  it("o buraco da nave: no meio da sala de reuniões, num piso livre; a chegada (vindo da cabine) fica fora dele", () => {
    const sala = COMODOS.find((c) => c.id === "reunioes")!;
    expect(BURACO_NAVE.x).toBeGreaterThan(sala.x0 + BURACO_NAVE.r); expect(BURACO_NAVE.x).toBeLessThan(sala.x1 - BURACO_NAVE.r);
    const no = { x: BURACO_NAVE.x, z: BURACO_NAVE.z, nivel: 0 as const };
    expect(andarNaNave(no, no)).toMatchObject({ x: no.x, z: no.z, nivel: 0 });   // nada empurra quem pisa nele
    expect(naBocaNave(no)).toBe(true); expect(naBocaNave({ ...no, nivel: 1 })).toBe(false);
    const ch = { ...CHEGADA_NAVE, nivel: 0 as const };
    expect(naBocaNave(ch)).toBe(false); expect(andarNaNave(ch, ch)).toMatchObject({ x: ch.x, z: ch.z });
  });
});

describe("chegar pelo túnel", () => {
  it("a chegada fica LONGE do anel (≥ 14 m): a câmera, atrás de quem chega, não fica embaixo do buraco negro", () => {
    for (const id of IDS_NOS) { const n = NOS[id]; expect(Math.hypot(n.chegada.x - n.anel.x, n.chegada.z - n.anel.z)).toBeGreaterThanOrEqual(14); }
  });
});
