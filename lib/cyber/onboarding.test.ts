import { describe, expect, it } from "vitest";
import { BERCARIO_LOCAL, NASCIMENTO, ROTEIRO, TUBO, TUBOS, avancarGuia, deveNascerNoTubo, estadoDoTubo, peDaRecepcao, tuboDe } from "./onboarding";
import { AGENTES, ZAEON_ANFITRIA, noPisoDaZaeon, posDoGuia } from "./agentes";
import { CIDADE, colisoresDaCidade, mundo, naIlhaPrincipal } from "./ceu";
import { POIS, marcoNav } from "./landmarks";
import { alturaEm } from "./nav";
import { dentroDeAlgum } from "./colisao";
import { NOS } from "./buracos";
import { PERSONAS } from "@/lib/ai/personas";

const recepcao = marcoNav(POIS.find((p) => p.id === "zaeon")!)!;

describe("quem chega NASCE num tubo de ensaio", () => {
  it("nasce: quem nunca viu o hiperespaço novo; o dono nasce na nave; `?nascer=1` força", () => {
    expect(deveNascerNoTubo({ visto: false, forcar: false, fundador: false })).toBe(true);
    expect(deveNascerNoTubo({ visto: true, forcar: false, fundador: false })).toBe(false);
    expect(deveNascerNoTubo({ visto: false, forcar: false, fundador: true })).toBe(false);
    expect(deveNascerNoTubo({ visto: true, forcar: true, fundador: true })).toBe(true);
  });
  it("o berçário: 6 tubos no piso da Zaeon, ao lado da Recepção (fora da ilha e da escada dela), sem encostar uns nos outros", () => {
    expect(TUBOS).toHaveLength(6);
    for (const [i, t] of TUBOS.entries()) {
      expect(naIlhaPrincipal(t)).toBe(true);
      expect(dentroDeAlgum(t, colisoresDaCidade())).toBe(false);
      expect(Math.hypot(t.x - recepcao.x, t.z - recepcao.z)).toBeGreaterThan(recepcao.nav.chaoR + TUBO.r + 2);
      expect(alturaEm(recepcao, t)).toBe(0);   // fora da escada
      for (const o of TUBOS.slice(i + 1)) expect(Math.hypot(t.x - o.x, t.z - o.z)).toBeGreaterThan(2 * TUBO.r + 0.5);
      // sai-se pra frente, rumo ao meio do berçário, num piso livre
      const c = mundo(BERCARIO_LOCAL), fora = { x: t.x + Math.sin(t.rumo) * 2.6, z: t.z + Math.cos(t.rumo) * 2.6 };
      expect(Math.hypot(fora.x - c.x, fora.z - c.z)).toBeLessThan(Math.hypot(t.x - c.x, t.z - c.z));
      for (const o of TUBOS) expect(Math.hypot(fora.x - o.x, fora.z - o.z)).toBeGreaterThan(1.4);
    }
    expect(Math.hypot(mundo(BERCARIO_LOCAL).x - NOS.zaeon.anel.x, mundo(BERCARIO_LOCAL).z - NOS.zaeon.anel.z)).toBeGreaterThan(60);
  });
  it("cada pessoa tem o SEU tubo (o mesmo sempre)", () => {
    for (const id of ["a".repeat(24), "b".repeat(24), "64f0c0ffee0000000000abcd"]) { const i = tuboDe(id); expect(i).toBe(tuboDe(id)); expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(TUBOS.length); }
  });
  it("o vidro: o líquido escoa, DEPOIS o vidro sobe; a pessoa sai com tudo aberto", () => {
    expect(estadoDoTubo(0)).toEqual({ liquido: 1, vidro: 0 });
    expect(estadoDoTubo(NASCIMENTO.escoa)).toEqual({ liquido: 0, vidro: 0 });
    expect(estadoDoTubo(NASCIMENTO.sai)).toEqual({ liquido: 0, vidro: 1 });
    let l = 2, v = -1; for (let t = 0; t <= NASCIMENTO.sai; t += 0.1) { const e = estadoDoTubo(t); expect(e.liquido).toBeLessThanOrEqual(l); expect(e.vidro).toBeGreaterThanOrEqual(v); l = e.liquido; v = e.vidro; }
  });
});

describe("o TOUR da anfitriã", () => {
  it("começa no tubo e acaba no 'tudo seu'; cada alvo fica num chão firme da Zaeon", () => {
    expect(ROTEIRO[0]!.id).toBe("nascer"); expect(ROTEIRO.at(-1)!.id).toBe("fim");
    expect(ROTEIRO.map((p) => p.id)).toEqual(["nascer", "lar", "capela", "motos", "buraco", "fim"]);
    for (const p of ROTEIRO) { expect(p.fala.length).toBeGreaterThan(20); if (p.alvo) expect(naIlhaPrincipal(p.alvo)).toBe(true); }
    const pe = peDaRecepcao(); expect(alturaEm(recepcao, pe)).toBe(0); expect(dentroDeAlgum(pe, colisoresDaCidade())).toBe(false);
  });
  it("chegar no alvo avança; longe não; andando de alvo em alvo vai até o fim", () => {
    expect(avancarGuia(0, mundo({ x: 0, z: 0 }))).toBe(0);   // nascendo: só o tubo avança
    expect(avancarGuia(1, mundo({ x: -200, z: 0 }))).toBe(1);
    let i = 1;
    for (let k = 0; k < 10 && ROTEIRO[i]!.alvo; k++) i = avancarGuia(i, ROTEIRO[i]!.alvo!);
    expect(ROTEIRO[i]!.id).toBe("fim");
    expect(avancarGuia(ROTEIRO.length - 1, ROTEIRO[1]!.alvo!)).toBe(ROTEIRO.length - 1);
  });
});

describe("os AGENTES que moram no hiperespaço", () => {
  it("a Zaeon (anfitriã): o cérebro é a persona 'zaeon'; mora na Recepção, no piso da Zaeon; tem personalidade, tarefas e funções", () => {
    expect(AGENTES).toContain(ZAEON_ANFITRIA);
    expect(PERSONAS[ZAEON_ANFITRIA.persona]?.name).toBe("Zaeon");
    expect(POIS.some((p) => p.id === ZAEON_ANFITRIA.lar.poi)).toBe(true);
    expect(noPisoDaZaeon(ZAEON_ANFITRIA.lar)).toBe(true);
    expect(ZAEON_ANFITRIA.personalidade.length).toBeGreaterThan(40);
    expect(ZAEON_ANFITRIA.tarefas.length).toBeGreaterThanOrEqual(3); expect(ZAEON_ANFITRIA.funcoes).toContain("guiar");
    expect(new Set(AGENTES.map((a) => a.id)).size).toBe(AGENTES.length);
    expect(CIDADE.pisoY).toBeGreaterThan(0);
  });
  it("guiando: anda à DIREITA e um pouco à FRENTE de quem ela leva (o rosto dela aparece pra câmera)", () => {
    const p = { x: 10, z: 10 }, g = posDoGuia(p, 0);   // olhando pra +z: a direita é −x
    expect(g.x).toBeLessThan(p.x); expect(g.z).toBeGreaterThan(p.z);
    const g2 = posDoGuia(p, Math.PI / 2);   // olhando pra +x: a direita é +z
    expect(g2.z).toBeGreaterThan(p.z); expect(g2.x).toBeGreaterThan(p.x);
  });
});
