import { describe, expect, it } from "vitest";
import { RotinaExaminer, ROTINA_EXAMINER, lugarNaPista, lugarNoAltar, rotaAltarPista } from "./examiner";
import { ALTURA_LOUNGE, CIDADE, PISO_FESTA, alturaNaCidade, mundo, naPistaDeDanca, naSala } from "./ceu";
import { TEMPLO, noTemplo } from "./templo";
import { comprimento } from "./caminhos";

/** um acaso fixo (sequência) */
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]!; };
const rodar = (r: RotinaExaminer, seg: number, musica: boolean) => { for (let t = 0; t < seg; t += 0.5) r.passo(0.5, musica); };

describe("a Examiner: o altar do lounge e, com música, a pista", () => {
  it("o altar fica DENTRO do templo (lá em cima); a pista, na área de dança", () => {
    const a = lugarNoAltar(), qa = naSala(CIDADE.salas.lounge, a.x, a.z);
    expect(noTemplo(qa)).toBe(true); expect(alturaNaCidade(mundo(a))).toBeCloseTo(ALTURA_LOUNGE + TEMPLO.h, 3);
    expect(naPistaDeDanca(mundo(lugarNaPista()))).toBe(true);
  });
  it("o caminho desce a escadaria: começa no altar, termina na pista, sem cair no vazio no meio", () => {
    const r = rotaAltarPista(), L = comprimento(r);
    expect(L).toBeGreaterThan(80);
    for (let i = 0; i < r.length; i++) expect(alturaNaCidade(mundo(r[i]!)), `ponto ${i}`).toBeGreaterThan(ALTURA_LOUNGE - 0.5);   // (nada abaixo do pátio do lounge = nada no vazio)
  });
  it("sem música, nunca sai do altar", () => {
    const r = new RotinaExaminer(seq(0, 0.1)); rodar(r, 1200, false);
    expect(r.fase).toBe("altar"); expect(r.estado().y).toBeCloseTo(ALTURA_LOUNGE + TEMPLO.h, 3);
  });
  it("com música, às vezes desce, dança na pista e volta; se a música para, volta pro altar", () => {
    const r = new RotinaExaminer(seq(0, 0.1)); const vistas = new Set<string>();
    for (let t = 0; t < 900; t += 0.5) { r.passo(0.5, true); vistas.add(r.fase); if (r.fase === "pista") { const e = r.estado(); expect(e.danca).toBe(1); expect(e.y).toBeGreaterThanOrEqual(PISO_FESTA - 0.01); } }
    expect([...vistas].sort()).toEqual(["altar", "descendo", "pista", "subindo"]);
    const p = new RotinaExaminer(seq(0, 0.1)); rodar(p, ROTINA_EXAMINER.altar[0] + 1, true); expect(p.fase).toBe("descendo");
    while (p.fase === "descendo") p.passo(0.5, true);
    expect(p.fase).toBe("pista"); p.passo(0.5, false); expect(p.fase).toBe("subindo");
  });
});
