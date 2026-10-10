import { describe, expect, it } from "vitest";
import { BOX_CK, CONTAGEM_CK, DURACAO_CK, PISTA_CK, andouBot, botEm, botsDaCorrida, crDe, faseCk, gridCk, lerCr, noBoxCk, novaCorridaCk, passoCk, vencedores } from "./checkpoints";
import { pistaPorId } from "./pistas";
import { PRACA } from "../praca";

const pista = pistaPorId(PISTA_CK)!, T0 = 1_790_000_000_000;
/** atravessa o portão `i` (de trás pra frente, `fora` m de lado — 0 = pelo meio do anel) */
const atravessa = (i: number, fora = 0) => {
  const g = pista.portoes[i]!, fx = Math.sin(g.rumo), fz = Math.cos(g.rumo), lx = Math.cos(g.rumo) * fora, lz = -Math.sin(g.rumo) * fora;
  return { de: { x: g.x - fx * 3 + lx, y: g.y, z: g.z - fz * 3 + lz }, para: { x: g.x + fx * 3 + lx, y: g.y, z: g.z + fz * 3 + lz } };
};

describe("corrida de CHECKPOINTS (sem estatística: quem pegar mais ganha)", () => {
  it("solo: eu contra 3 bots; dupla: contra 2 — os mesmos bots pra mesma semente (os dois da dupla veem igual)", () => {
    expect(botsDaCorrida(7, "solo")).toHaveLength(3); expect(botsDaCorrida(7, "dupla")).toHaveLength(2);
    expect(botsDaCorrida(7, "dupla")).toEqual(botsDaCorrida(7, "dupla"));
  });
  it("o relógio: contagem → correndo → fim, com a duração da corrida", () => {
    const c = novaCorridaCk("solo", 1, T0);
    expect(faseCk(c, T0 - CONTAGEM_CK * 1000)).toMatchObject({ fase: "contagem", contagem: CONTAGEM_CK });
    expect(faseCk(c, T0 + 1000).fase).toBe("correndo"); expect(faseCk(c, T0 + DURACAO_CK * 1000).fase).toBe("fim");
  });
  it("só conta o PRÓXIMO checkpoint, cruzado POR DENTRO do anel — por fora não vale; pulou, ele continua o próximo", () => {
    let c = novaCorridaCk("solo", 1, T0); const agora = T0 + 5000;
    const fora = atravessa(1, pista.portoes[1]!.r * 1.6);
    expect(passoCk(c, pista, fora.de, fora.para, agora).pegou).toBe(false);                 // por fora do anel
    const pulou = atravessa(2); expect(passoCk(c, pista, pulou.de, pulou.para, agora).pegou).toBe(false);   // o 2 antes do 1
    const certo = atravessa(1); const r = passoCk(c, pista, certo.de, certo.para, agora); expect(r.pegou).toBe(true); c = r.c;
    expect(c.meus).toBe(1); expect(c.proximo).toBe(2);
    const contra = atravessa(2); expect(passoCk(c, pista, contra.para, contra.de, agora).pegou).toBe(false);   // na contramão
    // na contagem e depois do fim, nada conta
    const c2 = novaCorridaCk("solo", 1, T0); expect(passoCk(c2, pista, certo.de, certo.para, T0 - 500).pegou).toBe(false); expect(passoCk(c2, pista, certo.de, certo.para, T0 + DURACAO_CK * 1000 + 1).pegou).toBe(false);
    // dá a volta: depois do último vem a largada (0) e o 1 de novo
    let d = { ...novaCorridaCk("solo", 1, T0), proximo: pista.portoes.length - 1 };
    for (const i of [pista.portoes.length - 1, 0, 1]) { const a = atravessa(i); d = passoCk(d, pista, a.de, a.para, agora).c; }
    expect(d.meus).toBe(3); expect(d.proximo).toBe(2);
  });
  it("os bots andam pela pista sempre pra frente, pegando checkpoints num ritmo que dá pra bater", () => {
    const c = novaCorridaCk("solo", 42, T0);
    for (const b of c.bots) {
      for (let t = 0; t < DURACAO_CK; t += 0.5) expect(andouBot(b, t + 0.5)).toBeGreaterThan(andouBot(b, t));
      expect(botEm(b, pista, c, T0 - 2000).ck).toBe(0);
      const fim = botEm(b, pista, c, T0 + DURACAO_CK * 1000).ck, passo = pista.comprimento / pista.portoes.length;
      expect(fim).toBeGreaterThan(10); expect(fim).toBeLessThan((DURACAO_CK * 155) / passo);   // < a moto no máximo sem boost
    }
  });
  it("ganha quem pegou mais; empate entre gente e bot fica com a gente", () => {
    expect(vencedores([{ id: "eu", nome: "Eu", cor: "", ck: 9 }, { id: "bot-ck-0", nome: "Bot", cor: "", ck: 7 }]).map((x) => x.id)).toEqual(["eu"]);
    expect(vencedores([{ id: "eu", nome: "Eu", cor: "", ck: 7 }, { id: "bot-ck-0", nome: "Bot", cor: "", ck: 7 }]).map((x) => x.id)).toEqual(["eu"]);
    expect(vencedores([{ id: "eu", nome: "Eu", cor: "", ck: 5 }, { id: "bot-ck-1", nome: "Bot", cor: "", ck: 7 }]).map((x) => x.id)).toEqual(["bot-ck-1"]);
  });
  it("o convite da dupla vai na pose (`cr`) e volta igual; lixo não vira corrida", () => {
    const c = novaCorridaCk("dupla", 12345, T0); expect(lerCr(crDe(c))).toEqual({ semente: 12345, inicio: T0 });
    expect(lerCr("abc")).toBeNull(); expect(lerCr(3)).toBeNull(); expect(lerCr("1:2")).toBeNull();
  });
  it("o box de largada fica do lado da largada, fora da praça; o grid da dupla não põe uma moto em cima da outra", () => {
    const g = pista.grid; expect(Math.hypot(BOX_CK.x - g.x, BOX_CK.z - g.z)).toBeLessThan(90);
    expect(Math.hypot(BOX_CK.x - PRACA.x, BOX_CK.z - PRACA.z)).toBeGreaterThan(PRACA.r + BOX_CK.r);
    expect(noBoxCk(BOX_CK)).toBe(true); expect(noBoxCk({ x: BOX_CK.x + BOX_CK.r + 1, y: BOX_CK.y, z: BOX_CK.z })).toBe(false);
    const a = gridCk(pista, 0), b = gridCk(pista, 1); expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(8);
  });
});
