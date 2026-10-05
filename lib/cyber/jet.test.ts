import { describe, expect, it } from "vitest";
import { POIS, marcoNav } from "./landmarks";
import { colisoresDoAlto, deEscada } from "./nav";
import { dentroDeAlgum } from "./colisao";
import { pilaresDoMarco } from "./voo";
import { JET, JET_CEU, chaoNoAr, passoHorizontalJet, passoVertical, resolverNoAr, tetoDoJet, type QGNoAr } from "./jet";

const Z = POIS.find((p) => p.id === "zaeon")!;
const mn = marcoNav(Z)!;
const qg: QGNoAr = { ...mn, topoMuralhas: pilaresDoMarco({ x: Z.x, z: Z.z, chaoR: mn.nav.chaoR, altura: Z.altura, escala: Z.escala ?? 1, cupula: false })[0]!.topo };

/** simula segurar/soltar ESPAÇO e andar numa direção, com pouso, como o engine faz */
function voar(ini: { x: number; z: number; y: number }, passos: { seg: number; subir: boolean; dir?: { x: number; z: number } }[]) {
  let p = { x: ini.x, z: ini.z }, y = ini.y, vy = 0, pousou = false;
  const dt = 1 / 60, teto = tetoDoJet(qg);
  for (const ps of passos) for (let i = 0; i < ps.seg * 60; i++) {
    const yAnt = y; const v = passoVertical(y, vy, ps.subir, dt, teto); y = v.y; vy = v.vy;
    const prop = ps.dir ? { x: p.x + ps.dir.x * 4 * dt, z: p.z + ps.dir.z * 4 * dt } : p;
    p = resolverNoAr(p, prop, y, yAnt, qg, []);
    const chao = chaoNoAr(p, qg);
    if (y <= chao && vy <= 0) { y = chao; pousou = true; break; }
    pousou = false;
  }
  return { p, y, vy, pousou };
}

describe("mochila a jato", () => {
  it("segurando sobe; o teto fica pouco acima das muralhas do QG (perto da altura dele)", () => {
    const r = voar({ x: 40, z: 40, y: 0 }, [{ seg: 8, subir: true }]);
    expect(r.y).toBeCloseTo(tetoDoJet(qg), 6);
    expect(tetoDoJet(qg)).toBeGreaterThan(qg.nav.pisoY + 3);   // dá pra sobrevoar o salão
    expect(tetoDoJet(qg)).toBeLessThan(30);                     // mas não vai pro céu (a Zaeon fica a 215 m)
  });
  it("soltou: cai planando (sem despencar) e pousa no chão", () => {
    const r = voar({ x: 40, z: 40, y: 0 }, [{ seg: 2, subir: true }, { seg: 6, subir: false }]);
    expect(r.pousou).toBe(true); expect(r.y).toBe(0);
    let vy = 0, y = 15; for (let i = 0; i < 600; i++) ({ y, vy } = passoVertical(y, vy, false, 1 / 60, 99)); expect(vy).toBeGreaterThanOrEqual(-JET.quedaMax);
  });
  /** anda reto em direção ao centro do QG, numa altura fixa */
  const entrar = (ang: number, y: number, de: number, metros = 7) => {
    let p = { x: qg.x + Math.cos(ang) * de, z: qg.z + Math.sin(ang) * de };
    for (let i = 0; i < metros / 0.05; i++) p = resolverNoAr(p, { x: p.x - Math.cos(ang) * 0.05, z: p.z - Math.sin(ang) * 0.05 }, y, y, qg, []);
    return Math.hypot(p.x - qg.x, p.z - qg.z);
  };
  it("baixo (abaixo do piso), a ilha do QG é sólida — desliza pra fora", () => {
    expect(entrar(qg.nav.escada.dir + 1.4, 3, qg.nav.chaoR + 4)).toBeGreaterThanOrEqual(qg.nav.chaoR - 1e-6);
  });
  it("acima das muralhas entra por cima e, soltando, pousa no PISO do salão", () => {
    const fora = { x: qg.x + qg.nav.chaoR + 4, z: qg.z };
    const r = voar({ ...fora, y: 0 }, [{ seg: 6, subir: true }, { seg: 4.2, subir: true, dir: { x: -1, z: 0 } }, { seg: 5, subir: false }]);
    expect(r.pousou).toBe(true); expect(r.y).toBeCloseTo(qg.nav.pisoY, 6);
    expect(dentroDeAlgum(r.p, colisoresDoAlto(qg))).toBe(false);
  });
  it("na altura das muralhas elas são sólidas — mas o PORTÃO deixa entrar", () => {
    const dir = qg.nav.escada.dir, y = qg.nav.pisoY + 1;
    expect(entrar(dir + 1.4, y, qg.nav.bordaR + 0.5)).toBeGreaterThan(qg.nav.muralhaR - 1.5);   // barrado na muralha
    expect(entrar(dir, y, qg.nav.bordaR + 0.5)).toBeLessThan(qg.nav.muralhaR - 4);             // pelo portão, entra
  });
  it("as bases do chão só bloqueiam quem voa baixo", () => {
    const base = [{ x: 0, z: 0, r: 2.4 }];
    expect(dentroDeAlgum(resolverNoAr({ x: 3, z: 0 }, { x: 0.5, z: 0 }, 2, 2, null, base), base)).toBe(false);
    expect(resolverNoAr({ x: 3, z: 0 }, { x: 0.5, z: 0 }, JET.alturaBases + 1, JET.alturaBases + 1, null, base)).toEqual({ x: 0.5, z: 0 });
  });
  it("chão embaixo: degrau da escada, piso do salão ou chão do mapa", () => {
    expect(chaoNoAr({ x: qg.x, z: qg.z }, qg)).toBe(qg.nav.pisoY);
    expect(chaoNoAr({ x: 60, z: 60 }, qg)).toBe(0);
    const meio = deEscada(qg, qg.nav.bordaR + qg.nav.escada.comprimento / 2, 0);
    expect(chaoNoAr(meio, qg)).toBeCloseTo(qg.nav.pisoY / 2, 5);
  });
  it("impulso no ar: W leva a toda (bem mais rápido que andar), com embalo; soltou, freia devagar; empurrando, plana", () => {
    let v = { x: 0, z: 0 }; for (let i = 0; i < 120; i++) v = passoHorizontalJet(v, { x: 0, z: -JET.velFrente }, 1 / 60);
    expect(-v.z).toBeGreaterThan(JET.velFrente * 0.85); expect(JET.velFrente).toBeGreaterThan(7.5 * 2);   // > 2× correr
    const solto = passoHorizontalJet(v, null, 0.5); expect(-solto.z).toBeGreaterThan(-v.z * 0.5); expect(-solto.z).toBeLessThan(-v.z);   // embalo
    let a = { y: 10, vy: 0 }, b = { y: 10, vy: 0 };
    for (let i = 0; i < 60; i++) { a = passoVertical(a.y, a.vy, false, 1 / 60, 50); b = passoVertical(b.y, b.vy, false, 1 / 60, 50, true); }
    expect(b.y).toBeGreaterThan(a.y);   // planando cai mais devagar
  });
  it("zona sem gravidade (céu): cai DEVAGAR — sair da borda da Zaeon é descer flutuando", () => {
    let a = { y: 200, vy: 0 }, b = { y: 20, vy: 0 };
    for (let i = 0; i < 180; i++) { a = passoVertical(a.y, a.vy, false, 1 / 60, 400); b = passoVertical(b.y, b.vy, false, 1 / 60, 400); }
    expect(-a.vy).toBeLessThanOrEqual(JET_CEU.quedaMax + 1e-9);   // no céu: teto de queda baixo
    expect(200 - a.y).toBeLessThan(20 - b.y);                       // em 3 s desce bem menos que perto do chão
  });
});

