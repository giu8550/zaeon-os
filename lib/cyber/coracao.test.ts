import { describe, expect, it } from "vitest";
import { ANGULO_DE_OURO, CORACAO, R_SOM_CORACAO, ouveOCoracao, ESTACOES, T_CORACAO, TOPO_DA_CAPELA, atrasoNoChao, bateAgora, batidaNoCoracao, colisoresDasEstacoes, disparaRaio, estacoesLocais, gerarVeias, meridianoDaCapela, pulso } from "./coracao";
import { CIDADE, CAPELA } from "./ceu";

describe("o ciclo do coração da Zaeon: raio → desce a capela → bate → ondas pela cidade", () => {
  it("o 'tum-tum': 1ª bulha forte, a 2ª mais fraca ~0,3 s depois, silêncio no resto do ciclo", () => {
    expect(pulso(0)).toBeCloseTo(1, 1); expect(pulso(CORACAO.dub)).toBeGreaterThan(0.5); expect(pulso(CORACAO.dub)).toBeLessThan(pulso(0));
    expect(pulso(1.2)).toBeLessThan(0.02); expect(pulso(CORACAO.ciclo * 3)).toBeCloseTo(pulso(0), 5);
  });
  it("o raio cai no começo do ciclo; o coração bate DEPOIS, quando o pulso desce até o globo", () => {
    const Tc = T_CORACAO(); expect(Tc).toBeGreaterThan(0.5); expect(Tc).toBeLessThan(CORACAO.ciclo - CORACAO.dub - 0.3);
    let raios = 0, batidas = 0; const dt = 1 / 60; for (let t = 0; t < 26; t += dt) { raios += +disparaRaio(t, t + dt); batidas += +bateAgora(t, t + dt); }
    expect(raios).toBe(Math.floor(26 / CORACAO.ciclo)); expect(Math.abs(batidas - raios)).toBeLessThanOrEqual(1);   // 1 raio → 1 batida
    expect(batidaNoCoracao(Tc)).toBeCloseTo(1, 1); expect(batidaNoCoracao(0.05)).toBeLessThan(0.05);           // no raio, o coração ainda está quieto
  });
  it("a onda sai do CENTRO em círculos: o atraso no piso cresce com a distância", () => {
    expect(atrasoNoChao(0, 0)).toBeCloseTo(T_CORACAO(), 5);
    expect(atrasoNoChao(100, 0)).toBeCloseTo(atrasoNoChao(0, 100), 5); expect(atrasoNoChao(200, 0)).toBeGreaterThan(atrasoNoChao(100, 0));
  });
});

describe("as veias (raízes: colonização de espaço + espiral de ouro + Murray)", () => {
  const { veias, distTopo } = gerarVeias();
  const doPiso = veias.filter((v) => !v.p.some((y, i) => i % 3 === 1 && y > 1));
  it("são determinísticas e cobrem a cidade (até perto da borda, nunca fora)", () => {
    expect(gerarVeias().veias.length).toBe(veias.length);
    let rMax = 0; for (const v of doPiso) for (let i = 0; i < v.p.length; i += 3) rMax = Math.max(rMax, Math.hypot(v.p[i]!, v.p[i + 2]!));
    expect(rMax).toBeGreaterThan(CIDADE.muralhaR + 4); expect(rMax).toBeLessThanOrEqual(CIDADE.bordaR);   // passam das cápsulas de nascimento e vão até a beira
    expect(doPiso.length).toBeGreaterThan(200); expect(gerarVeias({ low: true }).veias.length).toBeLessThan(veias.length);
    expect(ANGULO_DE_OURO * 180 / Math.PI).toBeCloseTo(137.5, 1);
  });
  it("NENHUMA veia cruza outra (só se encontram nas bifurcações)", () => {
    const seg: number[][] = []; for (const v of doPiso) for (let i = 0; i + 5 < v.p.length; i += 3) seg.push([v.p[i]!, v.p[i + 2]!, v.p[i + 3]!, v.p[i + 5]!]);
    const lado = (a: number[], b: number[], c: number[]) => (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
    const perto = (p: number[], q: number[]) => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!) < 0.8;
    const grade = new Map<string, number[]>(); seg.forEach((s, i) => { const k = `${Math.floor(s[0]! / 8)},${Math.floor(s[1]! / 8)}`; (grade.get(k) ?? grade.set(k, []).get(k)!).push(i); });
    let cruzes = 0;
    seg.forEach((s, i) => { const A = [s[0]!, s[1]!], B = [s[2]!, s[3]!], cx = Math.floor(s[0]! / 8), cz = Math.floor(s[1]! / 8);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of grade.get(`${cx + a},${cz + b}`) ?? []) { if (j <= i) continue; const t = seg[j]!, C = [t[0]!, t[1]!], D = [t[2]!, t[3]!];
        if (perto(A, C) || perto(A, D) || perto(B, C) || perto(B, D)) continue;
        if (lado(A, B, C) * lado(A, B, D) < 0 && lado(C, D, A) * lado(C, D, B) < 0) cruzes++; } });
    expect(cruzes).toBe(0);
  });
  it("toda veia vai até a BEIRA (depois das cápsulas de nascimento) — nenhuma acaba no meio da cidade", () => {
    const inicios = new Set(veias.map((v) => `${v.p[0]!.toFixed(1)},${v.p[2]!.toFixed(1)}`));
    for (const v of doPiso) { const x = v.p.at(-3)!, z = v.p.at(-1)!; if (inicios.has(`${x.toFixed(1)},${z.toFixed(1)}`)) continue; expect(Math.hypot(x, z)).toBeGreaterThan(CIDADE.muralhaR); }
  });
  it("o calibre segue Murray: grossas no coração, finas nas pontas; o azul corre do coração pra fora", () => {
    const perto = doPiso.filter((v) => Math.hypot(v.p[0]!, v.p[2]!) < 15), longe = doPiso.filter((v) => Math.hypot(v.p.at(-3)!, v.p.at(-1)!) > 180);
    const media = (l: typeof doPiso, f: (v: (typeof doPiso)[number]) => number) => l.reduce((s, v) => s + f(v), 0) / l.length;
    expect(media(perto, (v) => v.w[0]!)).toBeGreaterThan(2 * media(longe, (v) => v.w.at(-1)!));
    for (const v of doPiso) expect(v.a.at(-1)!).toBeGreaterThanOrEqual(v.a[0]! - 1e-6);
  });
  it("DENTRO da capela só 8 troncos RETOS, do globo (onde o holograma nasce) até os pilares — o pátio fica limpo", () => {
    const PE = CAPELA.r + 2.2, dentro = doPiso.filter((v) => { for (let i = 0; i < v.p.length; i += 3) if (Math.hypot(v.p[i]!, v.p[i + 2]!) < PE - 1.5) return true; return false; });
    expect(dentro).toHaveLength(8);
    for (const v of dentro) {
      expect(Math.hypot(v.p[0]!, v.p[2]!)).toBeLessThan(CIDADE.mesaHolo.r + 1);   // nasce no globo
      const a0 = Math.atan2(v.p[2]!, v.p[0]!);
      for (let i = 0; i < v.p.length; i += 3) if (Math.hypot(v.p[i]!, v.p[i + 2]!) < PE - 1.5) expect(Math.abs(Math.atan2(v.p[i + 2]!, v.p[i]!) - a0)).toBeLessThan(0.01);   // reto (raio)
    }
  });
  it("o pulso DESCE a capela: 8 nervuras da ponta ao pé do pilar + o eixo central até o globo — tudo saindo do raio", () => {
    const altas = veias.filter((v) => Math.max(...v.p.filter((_, i) => i % 3 === 1)) > 100);   // (as nervuras e o eixo)
    expect(altas).toHaveLength(10);   // 8 nervuras + o eixo (2 fitas)
    const topo = TOPO_DA_CAPELA();
    for (const v of altas) {
      const iTopo = v.p.findIndex((_, i) => i % 3 === 1 && v.p[i]! === Math.max(...v.p.filter((_, k) => k % 3 === 1))) - 1;
      expect(v.a[iTopo / 3]!).toBeLessThan(0.05);                          // no topo: chega junto com o raio
      expect(Math.min(...v.a)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...v.p.filter((_, i) => i % 3 === 1))).toBeGreaterThan(topo.y - 3);
    }
    expect(distTopo).toBeGreaterThan(150);
    const m = meridianoDaCapela(); for (let i = 1; i < m.length; i++) expect(m[i]!.y).toBeGreaterThanOrEqual(m[i - 1]!.y - 0.8);
  });
});

describe("o som do coração", () => {
  it("só no CENTRO da capela (em volta do globo); no resto da cidade o pulso é só luz", () => {
    expect(ouveOCoracao({ x: 0, z: 0 })).toBe(true); expect(ouveOCoracao({ x: 14, z: 3 })).toBe(true);
    expect(ouveOCoracao({ x: R_SOM_CORACAO + 1, z: 0 })).toBe(false); expect(ouveOCoracao({ x: CAPELA.r, z: 0 })).toBe(false); expect(ouveOCoracao({ x: 150, z: 80 })).toBe(false);
  });
});

describe("as estações dos agentes", () => {
  it("anel em volta do pátio central: entre o globo e os pilares, viradas pro coração", () => {
    const es = estacoesLocais(); expect(es).toHaveLength(ESTACOES.n);
    for (const e of es) {
      const r = Math.hypot(e.x, e.z); expect(r - ESTACOES.platR).toBeGreaterThan(CIDADE.mesaHolo.r + 20); expect(r + ESTACOES.platR).toBeLessThan(CAPELA.r - 3);
      expect(Math.sin(e.rot) * -e.x + Math.cos(e.rot) * -e.z).toBeGreaterThan(0.99 * r);   // o +z local aponta pro centro
    }
    expect(colisoresDasEstacoes().length).toBeGreaterThan(ESTACOES.n * 5);
  });
});
