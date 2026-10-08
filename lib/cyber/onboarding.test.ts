import { describe, expect, it } from "vitest";
import { ANEL_TUBOS, NASCIMENTO, ROTEIRO, TUBO, TUBOS, TUBOS_DO_NOVATO, avancarGuia, deveNascerNoTubo, estadoDoTubo, peDaRecepcao, tuboDe } from "./onboarding";
import { CIDADE as C2, DOCA_ANGULO, TORRES_MURALHA, anguloDaTorre, naAberturaDaEscada } from "./ceu";
import { LAR_LOCAL } from "./landmarks";
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
  it("os tubos ficam em VOLTA da Zaeon, na linha da muralha (no lugar dos blocos), entre as torres de cristal — sem encostar nelas nem uns nos outros", () => {
    expect(TUBOS.length).toBeGreaterThan(250);
    const loc = (t: { x: number; z: number }) => ({ x: t.x - C2.centro.x, z: t.z - C2.centro.z });
    for (const [i, t] of TUBOS.entries()) {
      const l = loc(t);
      expect(Math.hypot(l.x, l.z)).toBeCloseTo(ANEL_TUBOS.r, 6);
      expect(naIlhaPrincipal(t)).toBe(true); expect(dentroDeAlgum(t, colisoresDaCidade())).toBe(false);
      for (let k = 0; k < TORRES_MURALHA.n; k++) { const a = anguloDaTorre(k); expect(Math.hypot(l.x - Math.cos(a) * C2.muralhaR, l.z - Math.sin(a) * C2.muralhaR)).toBeGreaterThan(TORRES_MURALHA.rBase + TUBO.r + 1); }
      const prox = TUBOS[i + 1]; if (prox) expect(Math.hypot(prox.x - t.x, prox.z - t.z)).toBeGreaterThan(2 * TUBO.r + 0.9);
      expect(naAberturaDaEscada(l.x, l.z)).toBe(false);   // o vão da escada do lounge fica livre
      expect(Math.abs(Math.atan2(Math.sin(t.ang - DOCA_ANGULO), Math.cos(t.ang - DOCA_ANGULO)))).toBeGreaterThan(ANEL_TUBOS.docaMeia - 1e-9);   // e a doca da nave
      // sai-se pra DENTRO da ilha, num piso firme
      const fora = { x: t.x + Math.sin(t.rumo) * 2.6, z: t.z + Math.cos(t.rumo) * 2.6 };
      expect(Math.hypot(loc(fora).x, loc(fora).z)).toBeLessThan(ANEL_TUBOS.r - 2);
    }
  });
  it("o novato nasce num tubo PERTO da Recepção (o tour começa lá), longe da ilha dela", () => {
    expect(TUBOS_DO_NOVATO.length).toBeGreaterThanOrEqual(8);
    const lar = mundo(LAR_LOCAL);
    for (const i of TUBOS_DO_NOVATO) {
      const t = TUBOS[i]!; expect(Math.hypot(t.x - lar.x, t.z - lar.z)).toBeLessThan(80);
      expect(Math.hypot(t.x - recepcao.x, t.z - recepcao.z)).toBeGreaterThan(recepcao.nav.chaoR + TUBO.r + 2); expect(alturaEm(recepcao, t)).toBe(0);
    }
  });
  it("cada pessoa tem o SEU tubo (o mesmo sempre)", () => {
    for (const id of ["a".repeat(24), "b".repeat(24), "64f0c0ffee0000000000abcd"]) { const i = tuboDe(id); expect(i).toBe(tuboDe(id)); expect(TUBOS_DO_NOVATO).toContain(i); }
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
