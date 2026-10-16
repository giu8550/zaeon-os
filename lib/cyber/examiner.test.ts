import { describe, expect, it } from "vitest";
import { RotinaExaminer, ROTINA_EXAMINER, lugarNaPista, lugarNaMesa, rotaMesaPista } from "./examiner";
import { ALTURA_LOUNGE, CIDADE, PISO_FESTA, alturaNaCidade, mundo, naPistaDeDanca, naSala } from "./ceu";
import { TEMPLO, noTemplo } from "./templo";
import { comprimento } from "./caminhos";

/** um acaso fixo (sequência) */
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]!; };
const rodar = (r: RotinaExaminer, seg: number, musica: boolean, gente = false) => { for (let t = 0; t < seg; t += 0.5) r.passo(0.5, musica, gente); };

describe("a Examiner: o desktop do templo, a pista e quem chega", () => {
  it("a mesa fica DENTRO do templo (lá em cima) e ela trabalha nela (a pose de digitar); a pista, na área de dança", () => {
    const a = lugarNaMesa(), qa = naSala(CIDADE.salas.lounge, a.x, a.z);
    expect(noTemplo(qa)).toBe(true); expect(alturaNaCidade(mundo(a))).toBeCloseTo(ALTURA_LOUNGE + TEMPLO.h, 3);
    expect(naPistaDeDanca(mundo(lugarNaPista()))).toBe(true);
    const e = new RotinaExaminer(seq(0.5)).estado(); expect(e.sentado).toBe(1); expect(e.atividade).toBe("trabalhar"); expect(e.andando).toBe(false);
  });
  it("o caminho desce a escadaria: começa na mesa, termina na pista, sem cair no vazio no meio", () => {
    const r = rotaMesaPista(), L = comprimento(r);
    expect(L).toBeGreaterThan(80);
    for (let i = 0; i < r.length; i++) expect(alturaNaCidade(mundo(r[i]!)), `ponto ${i}`).toBeGreaterThan(ALTURA_LOUNGE - 0.5);   // (nada abaixo do pátio do lounge = nada no vazio)
  });
  it("sem música e sem ninguém, nunca larga a mesa", () => {
    const r = new RotinaExaminer(seq(0, 0.1)); rodar(r, 1200, false);
    expect(r.fase).toBe("mesa"); expect(r.estado().y).toBeCloseTo(ALTURA_LOUNGE + TEMPLO.h, 3);
  });
  it("chegou alguém no templo: ela se levanta (~1 s), desce pro lounge e lá fica enquanto tiver gente; vazio um tempo, volta", () => {
    const r = new RotinaExaminer(seq(0.9)); r.passo(0.5, false, true); expect(r.fase).toBe("mesa");
    rodar(r, ROTINA_EXAMINER.reage + 0.5, false, true); expect(r.fase).toBe("descendo");
    rodar(r, 300, false, true); expect(r.fase).toBe("pista");
    expect(r.estado().danca).toBe(0);   // (sem música: fica em pé no lounge, não dança)
    rodar(r, ROTINA_EXAMINER.voltaVazio - 2, false); expect(r.fase).toBe("pista");   // ainda não: o templo acabou de esvaziar
    rodar(r, 4, false); expect(r.fase).toBe("subindo");
    rodar(r, 300, false); expect(r.fase).toBe("mesa");
  });
  it("subindo de volta e alguém aparece lá em cima: ela dá meia-volta", () => {
    const r = new RotinaExaminer(seq(0.9)); rodar(r, 2, false, true); rodar(r, 300, false, true); rodar(r, ROTINA_EXAMINER.voltaVazio + 2, false);
    expect(r.fase).toBe("subindo"); rodar(r, 5, false); const antes = r.estado().pos;
    r.passo(0.5, false, true); expect(r.fase).toBe("descendo");
    r.passo(0.5, false, true); const depois = r.estado().pos; expect(Math.hypot(depois.x - antes.x, depois.z - antes.z)).toBeGreaterThan(0);
  });
  it("com música, às vezes desce sozinha, dança na pista e volta; se a música para, volta pra mesa", () => {
    const r = new RotinaExaminer(seq(0, 0.1)); const vistas = new Set<string>();
    for (let t = 0; t < 900; t += 0.5) { r.passo(0.5, true); vistas.add(r.fase); if (r.fase === "pista") { const e = r.estado(); expect(e.danca).toBe(1); expect(e.y).toBeGreaterThanOrEqual(PISO_FESTA - 0.01); } }
    expect([...vistas].sort()).toEqual(["descendo", "mesa", "pista", "subindo"]);
    const p = new RotinaExaminer(seq(0, 0.1)); rodar(p, ROTINA_EXAMINER.mesa[0] + 1, true); expect(p.fase).toBe("descendo");
    while (p.fase === "descendo") p.passo(0.5, true);
    expect(p.fase).toBe("pista"); p.passo(0.5, false); expect(p.fase).toBe("subindo");
  });
});
