import { describe, expect, it } from "vitest";
import { ALCANCE_DESCANSO, codificarDescanso, decodificarDescanso, lugarPerto, lugaresDoLounge, podeDeitar, poseNoLugar, proximoModo } from "./descanso";
import { CIDADE, MOVEIS, colisoresDaCidade, salaEm, type NomeSala } from "./ceu";
import { dentroDeAlgum } from "./colisao";

const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("os lugares de descanso (todas as salas)", () => {
  const ls = lugaresDoLounge(), nomes = Object.keys(CIDADE.salas) as NomeSala[];
  const contar = (tipo: string) => nomes.reduce((n, s) => n + MOVEIS[s].filter((m) => m.tipo === tipo).length, 0);
  it("um por sofá (2 assentos + deitar), por puff (1 assento) e por PUFE (1 assento, pose relaxada)", () => {
    expect(ls.filter((l) => l.tipo === "sofa")).toHaveLength(contar("sofa"));
    expect(ls.filter((l) => l.tipo === "puff")).toHaveLength(contar("puff"));
    expect(ls.filter((l) => l.tipo === "pufe")).toHaveLength(contar("pufe"));
    for (const l of ls) { expect(l.assentos).toHaveLength(l.tipo === "sofa" ? 2 : 1); expect(!!l.deita).toBe(l.tipo === "sofa"); expect(l.relaxa).toBe(l.tipo === "pufe"); expect(l.frentes).toHaveLength(l.assentos.length); }
    for (const n of nomes.filter((x) => x !== "garagem")) expect(ls.some((l) => l.tipo === "pufe" && l.id.startsWith(n))).toBe(true);   // pufes nas salas de estar (no lounge, perto dos sofás); a garagem é dos veículos
  });
  it("ficam no disco de uma sala; quem senta olha pra frente do móvel; a FRENTE de cada assento e a saída ficam fora dos colisores", () => {
    const cs = colisoresDaCidade();
    for (const l of ls) {
      const a0 = l.assentos[0]!; expect(salaEm({ x: a0.x - CIDADE.centro.x, z: a0.z - CIDADE.centro.z })).not.toBeNull();
      const frente = { x: a0.x + Math.sin(l.rumo), z: a0.z + Math.cos(l.rumo) };
      expect(d(frente, l.saida)).toBeLessThan(d(a0, l.saida));   // a frente aponta pra saída
      expect(dentroDeAlgum(l.saida, cs)).toBe(false);
      l.frentes.forEach((f, k) => { expect(dentroDeAlgum(f, cs)).toBe(false); expect(d(f, l.assentos[k]!)).toBeGreaterThan(0.8); expect(d(f, l.assentos[k]!)).toBeLessThan(1.4); });
      if (l.deita) expect(d(l.assentos[0]!, l.assentos[1]!)).toBeCloseTo(1.5, 5);
    }
  });
});

describe("a tecla J", () => {
  const sofa = lugaresDoLounge().find((l) => l.tipo === "sofa")!, puff = lugaresDoLounge().find((l) => l.tipo === "puff")!, pufe = lugaresDoLounge().find((l) => l.tipo === "pufe")!;
  it("em pé → sentado → deitado → em pé (no sofá); no puff, só senta e levanta", () => {
    expect(proximoModo(null, sofa)).toBe("sentado"); expect(proximoModo("sentado", sofa)).toBe("deitado"); expect(proximoModo("deitado", sofa)).toBe(null);
    expect(proximoModo(null, puff)).toBe("sentado"); expect(proximoModo("sentado", puff)).toBe(null);
    expect(proximoModo(null, pufe)).toBe("sentado"); expect(proximoModo("sentado", pufe)).toBe(null);   // no pufe: larga o corpo e levanta
    expect(proximoModo(null, null)).toBe(null);
  });
  it("acha o assento LIVRE mais perto (alguém sentado ocupa); longe demais, nada", () => {
    const a = sofa.assentos[0]!, b = sofa.assentos[1]!;
    expect(lugarPerto({ x: a.x + 0.3, z: a.z })?.lugar.id).toBe(sofa.id);
    const r = lugarPerto({ x: a.x, z: a.z }, [a]); expect(r?.lugar.id === sofa.id ? r.assento : 1).toBe(1);   // o outro assento (ou outro lugar livre)
    expect(lugarPerto({ x: a.x + ALCANCE_DESCANSO * 3, z: a.z + ALCANCE_DESCANSO * 3 })).toBeNull();
    expect(podeDeitar(sofa, [b])).toBe(false); expect(proximoModo("sentado", sofa, [b])).toBe(null);   // alguém no sofá: não deita
  });
  it("deitado: no meio do sofá, o corpo ao longo dele", () => {
    const p = poseNoLugar(sofa, "deitado"); expect(d(p, sofa.deita!)).toBe(0);
    expect(Math.abs(Math.sin(p.rumo - sofa.rumo))).toBeCloseTo(1, 5);   // 90° do rumo sentado
  });
});

describe("a pose na rede", () => {
  it("vai e volta num inteiro pequeno; lixo vira em pé", () => {
    for (const modo of [null, "sentado", "deitado"] as const) for (const tablet of [false, true]) expect(decodificarDescanso(codificarDescanso(modo, tablet))).toEqual({ modo, tablet });
    for (const v of [-1, 6, 1.5, "2", null, undefined]) expect(decodificarDescanso(v)).toEqual({ modo: null, tablet: false });
  });
});
