import { describe, expect, it } from "vitest";
import { CAPELA, inicioDaPonta, ALTURA_LOUNGE, CIDADE, PISO_FESTA, alturaNaCidade, bocaDaGaragem, colisoresDaCidade, daSala, durDaViagem, rotDaSala, rumoNaSala, mundo, naColunaDaGaragem, naIlhaPrincipal, naSala, pisoNoAr, posDaViagem, resolverCidade, salaEm, solidosDaCidade } from "./ceu";
import { DECK, ESCADARIA, GARAGEM_LOUNGE, GARAGEM_LOUNGE_EXISTE, TEMPLO, naGaragemDoLounge, pontaDaCapelaDoTemplo, alturaDaEscadaria, curvaDaEscadaria, entradaDoTemplo, mesaDaExaminer, noTemplo, saidaDoLounge } from "./templo";
import { dentroDeAlgum } from "./colisao";
import { AMBIENTES_COM_VAGA } from "./estacionamentosEstudo";

const L = CIDADE.salas.lounge;
/** um ponto no referencial da sala do lounge → mundo */
const W = (x: number, z: number) => mundo(daSala(L, x, z));
const cs = colisoresDaCidade();

describe("o LOUNGE em dois níveis (pátio + deck da festa)", () => {
  it("~3× maior que o antigo (raio 40 → 70)", () => {
    expect((L.r * L.r) / (40 * 40)).toBeGreaterThan(2.9);
  });
  it("o pátio fica no piso da sala; o deck, DECK.h acima; a rampa sobe sem degrau", () => {
    expect(alturaNaCidade(W(0, 50))).toBe(ALTURA_LOUNGE);
    expect(alturaNaCidade(W(-40, 0))).toBe(PISO_FESTA);
    expect(PISO_FESTA - ALTURA_LOUNGE).toBe(DECK.h);
    let ant = alturaNaCidade(W(0, L.r - 1));
    for (let z = L.r - 1; z > -20; z -= 0.25) { const h = alturaNaCidade(W(0, z)); expect(h).toBeGreaterThanOrEqual(ant - 1e-9); expect(h - ant).toBeLessThan(0.2); ant = h; }   // da porta até a pista: só sobe, devagar
  });
  it("do pátio só se sobe pela rampa: a frente do deck é sólida, a boca da rampa e a calçada são livres", () => {
    for (const x of [-30, -15, 15, 30, 50]) expect(dentroDeAlgum(W(x, DECK.zFrente + 0.25), cs)).toBe(true);
    for (const z of [L.r - 1, 60, 45, DECK.zFrente + DECK.rampa.len, DECK.zFrente + 4, DECK.zFrente - 1]) for (const x of [-2, 0, 2]) expect(dentroDeAlgum(W(x, z), cs)).toBe(false);
    for (const sx of [-1, 1]) expect(dentroDeAlgum(W(sx * (DECK.rampa.meia + 0.3), DECK.zFrente + 6), cs)).toBe(true);   // laterais da rampa
  });
  it("ESPELHADO (o Templo Cósmico): pra quem entra no lounge olhando pro palco, a escadaria e a capela ficam à ESQUERDA — e o layout continua o mesmo", () => {
    const w0 = daSala(L, 0, 0), wF = daSala(L, 0, -10), wT = daSala(L, TEMPLO.x, TEMPLO.z), f = { x: wF.x - w0.x, z: wF.z - w0.z }, dir = { x: -f.z, z: f.x };   // (a direita de quem olha pra `f`)
    expect((wT.x - w0.x) * dir.x + (wT.z - w0.z) * dir.z).toBeLessThan(-50);
    const q = naSala(L, wT.x, wT.z); expect(q.x).toBeCloseTo(TEMPLO.x, 6); expect(q.z).toBeCloseTo(TEMPLO.z, 6);   // ida e volta
    expect(rumoNaSala(L, 0.4)).toBeCloseTo(rotDaSala(L) - 0.4, 9);
  });
  it("a GARAGEM do lounge saiu (o Templo Cósmico: no lugar dela, o salão central): sem piso, sem elevador, sem vagas", () => {
    const e = GARAGEM_LOUNGE.elevador, pe = W(e.pe.x, e.pe.z), topo = W(e.topo.x, e.topo.z);
    expect(GARAGEM_LOUNGE_EXISTE).toBe(false);
    expect(bocaDaGaragem(pe)).toBeNull(); expect(bocaDaGaragem(topo)).toBeNull();
    expect(naGaragemDoLounge(naSala(L, pe.x - CIDADE.centro.x, pe.z - CIDADE.centro.z))).toBe(false);
    expect(AMBIENTES_COM_VAGA).not.toContain("lounge");
    expect(solidosDaCidade().some((s) => Math.hypot(s.x - pe.x, s.z - pe.z) < s.r && s.topo < CIDADE.pisoY + ALTURA_LOUNGE - 5)).toBe(false);
  });
});

describe("a ESCADARIA em curva e o TEMPLO", () => {
  const { pts, len } = curvaDaEscadaria();
  it("sai da DIREITA do deck (o +x de quem entra pela porta) pela abertura na parede e chega na entrada do templo", () => {
    const sd = saidaDoLounge(L.r), p = { x: Math.cos(sd.ang) * L.r, z: Math.sin(sd.ang) * L.r };
    expect(p.x).toBeGreaterThan(60); expect(p.z).toBeLessThan(DECK.zFrente);   // à direita, no nível do deck
    expect(dentroDeAlgum(W(p.x, p.z), cs)).toBe(false);                        // a parede abre ali
    expect(dentroDeAlgum(W(Math.cos(sd.ang + 0.2) * L.r, Math.sin(sd.ang + 0.2) * L.r), cs)).toBe(true);   // e só ali
    expect(noTemplo(pts[pts.length - 1]!)).toBe(true);
    const e = entradaDoTemplo(); expect(dentroDeAlgum(W(TEMPLO.x + Math.cos(e.ang) * TEMPLO.r, TEMPLO.z + Math.sin(e.ang) * TEMPLO.r), cs)).toBe(false);
    expect(len).toBeGreaterThan(50);
  });
  it("a curva é acentuada mas CONTÍNUA (o rumo vira mais de 70° sem quinas)", () => {
    const rumo = (i: number) => Math.atan2(pts[i]!.tx, pts[i]!.tz);
    let total = 0;
    for (let i = 1; i < pts.length; i++) { let d = rumo(i) - rumo(i - 1); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; expect(Math.abs(d)).toBeLessThan(0.12); total += d; }
    expect(Math.abs(total)).toBeGreaterThan((70 * Math.PI) / 180);
  });
  it("andando pelo meio dela, do deck ao templo: nunca bate em nada, nunca cai, só sobe e sem degrau grande", () => {
    let ant = PISO_FESTA;
    for (let s = 0; s <= len; s += 0.3) {
      let i = 0; while (i < pts.length - 2 && pts[i + 1]!.s < s) i++;
      const a = pts[i]!, b = pts[i + 1]!, u = Math.min(1, Math.max(0, (s - a.s) / Math.max(1e-6, b.s - a.s))), q = W(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u);
      expect(dentroDeAlgum(q, cs)).toBe(false);
      expect(naIlhaPrincipal(q)).toBe(true);
      expect(resolverCidade(q)).toEqual(q);   // clicar pra andar não puxa de volta pra central
      const h = alturaNaCidade(q); expect(h).toBeGreaterThanOrEqual(ant - 1e-6); expect(h - ant).toBeLessThan(0.3); ant = h;
      expect(pisoNoAr(q, h)).toBe(h);
    }
    expect(ant).toBe(ALTURA_LOUNGE + TEMPLO.h);
    expect(alturaDaEscadaria(0)).toBe(DECK.h); expect(alturaDaEscadaria(len)).toBe(TEMPLO.h);
  });
  it("a muralha (fora da curva) e o guarda-corpo (dentro) seguram quem anda na escadaria", () => {
    for (const k of [0.3, 0.5, 0.7]) {
      const p = pts[Math.floor(pts.length * k)]!, off = ESCADARIA.meia + 0.35;
      for (const lado of [-1, 1]) expect(dentroDeAlgum(W(p.x + p.tz * off * lado, p.z - p.tx * off * lado), cs)).toBe(true);
    }
  });
  it("o templo fica bem acima do deck e a capela dele é MAIS ALTA que a da Zaeon", () => {
    expect(TEMPLO.h - DECK.h).toBeGreaterThanOrEqual(40);
    expect(ALTURA_LOUNGE + TEMPLO.h + pontaDaCapelaDoTemplo().topo).toBeGreaterThan(inicioDaPonta() + CAPELA.pontaLen + 30);
  });
  it("o templo: piso alto, o SIGILO no meio (pisa-se nele), a mesa da Examiner sólida do lado oposto à entrada", () => {
    const T = TEMPLO, c = W(T.x, T.z);
    expect(alturaNaCidade(W(T.x + 10, T.z))).toBe(ALTURA_LOUNGE + T.h);
    expect(dentroDeAlgum(c, cs)).toBe(false);                              // o sigilo (rente ao piso)
    expect(dentroDeAlgum(W(T.x + T.sigilo.r + 2.5, T.z), cs)).toBe(false); // em volta dele
    const m = mesaDaExaminer();
    expect(dentroDeAlgum(W(m.x, m.z), cs)).toBe(true);                     // a mesa
    expect(dentroDeAlgum(W(m.pe.x, m.pe.z), cs)).toBe(false);              // onde ela fica em pé
    expect(Math.hypot(m.pe.x - T.x, m.pe.z - T.z)).toBeGreaterThan(T.sigilo.r);   // fora do sigilo
    { const e = entradaDoTemplo().ang, ex = T.x + Math.cos(e) * T.r, ez = T.z + Math.sin(e) * T.r; expect(Math.hypot(m.x - ex, m.z - ez)).toBeGreaterThan(T.r); }   // longe da entrada
    expect(dentroDeAlgum(W(T.x + T.r, T.z), cs)).toBe(true);               // o guarda-corpo
    expect(salaEm({ x: c.x - CIDADE.centro.x, z: c.z - CIDADE.centro.z })).toBeNull();
    expect(naIlhaPrincipal(W(T.x + 10, T.z))).toBe(true);
    // longe das outras salas e fora da ilha central
    for (const n of ["garagem", "biblioteca", "jardim"] as const) { const s = CIDADE.salas[n], w = mundo(s); expect(Math.hypot(c.x - w.x, c.z - w.z)).toBeGreaterThan(s.r + T.r + 50); }
    expect(Math.hypot(c.x - CIDADE.centro.x, c.z - CIDADE.centro.z)).toBeGreaterThan(CIDADE.bordaR + T.r + 100);
  });
});
