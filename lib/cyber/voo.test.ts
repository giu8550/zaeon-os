import { describe, expect, it } from "vitest";
import { CIDADE, mundo } from "./ceu";
import { POIS } from "./landmarks";
import { posicaoDaBase } from "./bases";
import { VOO, chaoDoVoo, passoVoo, passoVooSub, pilaresDoMarco, type ComandoVoo, type EstadoVoo, type Pilar } from "./voo";

/** simula a pessoa segurando os BOTÕES de movimento a `fps` quadros por segundo (dt real, sem limite de 0,05) */
type Botoes = { dir?: { x: number; z: number } | null; subir?: boolean; descer?: boolean };
type Passo = { s: EstadoVoo; pousado: boolean; chaoY: number };
function pilotar(ini: Passo, fps: number, solidos: Pilar[], botoes: (r: Passo) => Botoes | "fim", maxSeg = 60) {
  let r = ini, t = 0;
  const trilha: EstadoVoo[] = [];
  while (t < maxSeg) {
    const b = botoes(r);
    if (b === "fim") break;
    const m = b.dir ? Math.hypot(b.dir.x, b.dir.z) || 1 : 1;
    const c: ComandoVoo = { wx: b.dir ? b.dir.x / m : 0, wz: b.dir ? b.dir.z / m : 0, subir: !!b.subir, descer: !!b.descer };
    r = passoVooSub(r.s, c, 1 / fps, solidos); t += 1 / fps; trilha.push(r.s);
  }
  return { r, t, trilha };
}
const est = (x: number, y: number, z: number): EstadoVoo => ({ x, y, z, yaw: 0, vx: 0, vy: 0, vz: 0 });
const daCidade = (p: { x: number; z: number }) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);
const rumo = (de: { x: number; z: number }, para: { x: number; z: number }) => ({ x: para.x - de.x, z: para.z - de.z });
/** nunca dentro do volume sólido da ilha */
const atravessouIlha = (tr: EstadoVoo[]) => tr.some((s) => daCidade(s) < CIDADE.bordaR - 1e-6 && s.y > CIDADE.pisoY - CIDADE.ilhaAltura + 1e-6 && s.y < CIDADE.pisoY - 1e-6);

const Z = POIS.find((p) => p.id === "zaeon")!;
const solidosZ = pilaresDoMarco({ x: Z.x, z: Z.z, chaoR: Z.nav!.chaoR, altura: Z.altura, escala: Z.escala ?? 1, cupula: true });
const hangar = mundo(CIDADE.hangar);
const noHangar: Passo = { s: est(hangar.x, CIDADE.pisoY, hangar.z), pousado: true, chaoY: CIDADE.pisoY };

/** Cidade → chão com os botões: sobe um pouco, sai pela borda (radial), segura DESCER até pousar */
function descerDaCidade(fps: number) {
  const out = { x: hangar.x - CIDADE.centro.x, z: hangar.z - CIDADE.centro.z };
  return pilotar(noHangar, fps, solidosZ, (r) => {
    if (r.s.y < 0.01 && r.pousado) return "fim";
    if (daCidade(r.s) < CIDADE.bordaR + 4) return { dir: out, subir: r.s.y < CIDADE.pisoY + 2 };
    return { descer: true };
  });
}

describe("voo — botões de movimento levam a nave a qualquer lugar", () => {
  for (const fps of [60, 10]) {
    it(`Cidade → chão saindo pela borda (≤ 8 s) a ${fps} FPS, sem atravessar a ilha`, () => {
      const { r, t, trilha } = descerDaCidade(fps);
      expect(r.pousado).toBe(true); expect(r.s.y).toBe(0);
      expect(t).toBeLessThanOrEqual(8);
      expect(atravessouIlha(trilha)).toBe(false);
    });
    it(`chão embaixo da ilha → Cidade (sai pela lateral, sobe, vai ao hangar, pousa) a ${fps} FPS`, () => {
      const ini: Passo = { s: est(CIDADE.centro.x + 5, 0, CIDADE.centro.z), pousado: true, chaoY: 0 };
      let fase = 0;
      const { r, trilha } = pilotar(ini, fps, solidosZ, (r) => {
        if (fase === 0) { if (daCidade(r.s) > CIDADE.bordaR + 4) fase = 1; else return { dir: { x: 1, z: 0 }, subir: r.s.y < 3 }; }
        if (fase === 1) { if (r.s.y > CIDADE.pisoY + 6) fase = 2; else return { subir: true }; }
        if (fase === 2) { const d = rumo(r.s, hangar); if (Math.hypot(d.x, d.z) < VOO.vel / VOO.freio) fase = 3; else return { dir: d }; }
        if (r.pousado) return "fim";
        return { descer: true };
      });
      expect(r.pousado).toBe(true); expect(r.s.y).toBe(CIDADE.pisoY);
      expect(Math.hypot(r.s.x - hangar.x, r.s.z - hangar.z)).toBeLessThan(CIDADE.hangar.r);
      expect(atravessouIlha(trilha)).toBe(false);
    });
  }

  it("embaixo da ilha, segurar SUBIR trava no fundo dela (a dica do HUD manda sair pela lateral)", () => {
    const ini: Passo = { s: est(CIDADE.centro.x, 0, CIDADE.centro.z + 12), pousado: true, chaoY: 0 };
    const { r } = pilotar(ini, 60, [], () => ({ subir: true }), 12);
    expect(r.s.y).toBeCloseTo(CIDADE.pisoY - CIDADE.ilhaAltura, 5);
  });
  it("bem no meio, embaixo: trava na PONTA da agulha (não atravessa a ponta afiada)", () => {
    const ini: Passo = { s: est(CIDADE.centro.x, 0, CIDADE.centro.z + 3), pousado: true, chaoY: 0 };
    const { r } = pilotar(ini, 60, [], () => ({ subir: true }), 12);
    expect(r.s.y).toBeCloseTo(CIDADE.pisoY - CIDADE.ilhaAltura - CIDADE.agulha.altura, 5);
  });

  it("voa da Cidade até a praça, uma base distante e a Zaeon (de lado) e pousa no chão em cada uma", () => {
    const destinos = [{ x: 0, z: 0 }, posicaoDaBase(17), { x: Z.x + Z.nav!.chaoR + 6, z: Z.z }];
    let atual = descerDaCidade(60).r;
    for (const alvo of destinos) {
      let perto = false;
      const { r } = pilotar(atual, 60, solidosZ, (r) => {
        const d = rumo(r.s, alvo);
        if (!perto && Math.hypot(d.x, d.z) < VOO.vel / VOO.freio) perto = true;   // solta o botão um pouco antes, como gente
        if (!perto) return { dir: d, subir: r.s.y < 6 };
        return r.pousado ? "fim" : { descer: true };
      });
      expect(r.pousado).toBe(true); expect(r.s.y).toBe(0);
      expect(Math.hypot(r.s.x - alvo.x, r.s.z - alvo.z)).toBeLessThan(3);
      expect(Math.hypot(r.s.x - Z.x, r.s.z - Z.z)).toBeGreaterThanOrEqual(Z.nav!.chaoR - 1e-6);   // nunca dentro da Zaeon
      atual = r;
    }
  });

  it("vindo de cima, pousa no topo da Zaeon (em cima da cúpula, onde fica a base do dono)", () => {
    const cupula = solidosZ[1]!;
    const { r } = pilotar({ s: est(Z.x, cupula.topo + 30, Z.z), pousado: false, chaoY: 0 }, 60, solidosZ, (r) => (r.pousado ? "fim" : { descer: true }));
    expect(r.pousado).toBe(true); expect(r.s.y).toBe(cupula.topo); expect(r.chaoY).toBe(cupula.topo);
    // segurar DESCER pousada lá em cima não atravessa a Zaeon
    const { r: r2 } = pilotar(r, 60, solidosZ, () => ({ descer: true }), 3);
    expect(r2.s.y).toBe(cupula.topo);
    // e dá pra sair voando de lado e descer até o chão do lado de fora
    let fora = false;
    const { r: r3 } = pilotar(r2, 60, solidosZ, (r) => {
      if (!fora && Math.hypot(r.s.x - Z.x, r.s.z - Z.z) > Z.nav!.chaoR + 3) fora = true;
      if (!fora) return { dir: { x: 1, z: 0 }, subir: true };
      return r.pousado ? "fim" : { descer: true };
    });
    expect(r3.s.y).toBe(0);
  });

  it("pousada no alto de um marco que FLUTUA, continua pousada (e acompanha) enquanto ele sobe e desce", () => {
    let r: Passo = { s: est(Z.x + 9, solidosZ[0]!.topo, Z.z), pousado: true, chaoY: solidosZ[0]!.topo };
    for (let i = 0; i < 240; i++) {
      const boia = Math.sin(i * 0.05) * 0.15;
      const sol = pilaresDoMarco({ x: Z.x, z: Z.z, chaoR: Z.nav!.chaoR, altura: Z.altura + boia, escala: Z.escala ?? 1, cupula: true });
      r = passoVooSub(r.s, { wx: 0, wz: 0, subir: false, descer: false }, 1 / 60, sol);
      expect(r.pousado).toBe(true); expect(r.s.y).toBeCloseTo(sol[0]!.topo, 6);
    }
    // e decola normalmente
    const sol = pilaresDoMarco({ x: Z.x, z: Z.z, chaoR: Z.nav!.chaoR, altura: Z.altura, escala: Z.escala ?? 1, cupula: true });
    for (let i = 0; i < 30; i++) r = passoVooSub(r.s, { wx: 0, wz: 0, subir: true, descer: false }, 1 / 60, sol);
    expect(r.pousado).toBe(false); expect(r.s.y).toBeGreaterThan(sol[0]!.topo + 2);
  });

  it("pousada no chão a nave NÃO anda de lado: tem que subir primeiro (acima de VOO.decolar) pra se mover", () => {
    const ini: Passo = { s: est(100, 0, 100), pousado: true, chaoY: 0 };
    const parada = pilotar(ini, 60, [], () => ({ dir: { x: 1, z: 0 } }), 2).r;
    expect(parada.s.x).toBe(100); expect(parada.s.z).toBe(100); expect(parada.pousado).toBe(true);
    // na Zaeon (céu) e no topo do QG, idem
    const naCidade = pilotar(noHangar, 60, solidosZ, () => ({ dir: { x: 1, z: 0 } }), 2).r;
    expect(naCidade.s.x).toBeCloseTo(hangar.x, 9);
    // subindo, passa a andar
    const sobe = pilotar(ini, 60, [], (r) => (r.s.y < VOO.decolar + 1 ? { subir: true } : { dir: { x: 1, z: 0 } }), 2).r;
    expect(sobe.s.x).toBeGreaterThan(110);
  });

  it("de lado, a Zaeon é sólida até o alto das muralhas (desliza pra fora)", () => {
    const { r } = pilotar({ s: est(Z.x + 30, 5, Z.z), pousado: false, chaoY: 0 }, 60, solidosZ, () => ({ dir: { x: -1, z: 0 } }), 6);
    expect(Math.hypot(r.s.x - Z.x, r.s.z - Z.z)).toBeGreaterThanOrEqual(Z.nav!.chaoR - 1e-6);
  });

  it("chão do voo: o mais alto entre mapa, cidade e topo dos marcos embaixo", () => {
    expect(chaoDoVoo({ x: 0, y: 5, z: 0 }, solidosZ)).toBe(0);
    expect(chaoDoVoo({ x: Z.x, y: solidosZ[1]!.topo + 1, z: Z.z }, solidosZ)).toBe(solidosZ[1]!.topo);
    expect(chaoDoVoo({ ...hangar, y: CIDADE.pisoY + 1 }, solidosZ)).toBe(CIDADE.pisoY);
  });

  it("o mapa inteiro cabe no voo (bases distantes e a Zaeon dentro do raio; teto acima da Cidade)", () => {
    for (const b of [posicaoDaBase(40), { x: Z.x, z: Z.z }]) expect(Math.hypot(b.x, b.z)).toBeLessThan(VOO.raioMapa);
    expect(VOO.yMax).toBeGreaterThan(CIDADE.pisoY + 40);
  });
});

describe("voo — independente de FPS", () => {
  it("10 s segurando SUBIR dão a mesma altura a 5 e a 60 FPS", () => {
    const ini: Passo = { s: est(100, 0, 100), pousado: true, chaoY: 0 };
    const alt = (fps: number) => pilotar(ini, fps, [], () => ({ subir: true }), 3).r.s.y;
    expect(Math.abs(alt(5) - alt(60))).toBeLessThan(1.5);
    expect(alt(60)).toBeGreaterThan(VOO.sobe * 2.4);   // ~34 m/s com inércia curta
  });
  it("quadro gigante (aba voltou do fundo) é limitado a dtMax e não atravessa nada", () => {
    const r = passoVooSub(est(Z.x + 30, 5, Z.z), { wx: -1, wz: 0, subir: false, descer: false }, 10, solidosZ);
    expect(Math.hypot(r.s.x - Z.x, r.s.z - Z.z)).toBeGreaterThanOrEqual(Z.nav!.chaoR - 1e-6);
    expect(Math.abs(r.s.x - (Z.x + 30))).toBeLessThanOrEqual(VOO.vel * VOO.dtMax + 1e-6);
  });
  it("passoVooSub com 1 subpasso = passoVoo", () => {
    const s = est(10, 20, 10), c = { wx: 1, wz: 0, subir: true, descer: false };
    expect(passoVooSub(s, c, 1 / 60)).toEqual(passoVoo(s, c, 1 / 60));
  });
});
