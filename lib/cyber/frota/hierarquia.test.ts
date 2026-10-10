import { describe, expect, it } from "vitest";
import { gerarFrota } from "./frota";
import { FLAGS_PADRAO, agendaBase, type Bloco } from "./agenda";
import { planejarDia } from "./plano";
import { estadoDaIA } from "./corpo";
import { RESTO_MESTRADO, agendaDaCidadela, credenciaisDaFrota, hierarquiaDaCidadela } from "./hierarquia";
import { spotsDe } from "./lugares";
import { CAPELA, CIDADE, FILEIRAS_CABINES, alturaNaCidade, cabinesDaCidadela, colisoresDaCidade, mundo, naIlhaPrincipal } from "../ceu";
import { LEVELS, MODELOS_CREDENCIAL, DOUTORES_NA_CIDADELA, credencialFicticia, degrauDoLevel, nomeComTitulo, podeFicarNaCidadela } from "../credenciais";
import { rodasDeEstudo } from "../cidadela";
import { SUPERTREES } from "../terra";

const frota = gerarFrota(), hier = hierarquiaDaCidadela(frota);
const porNivel = (n: string) => [...hier.values()].filter((m) => m.credencial.degrau === n);
const raio = (p: { x: number; z: number }) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);

describe("a HIERARQUIA da cidadela", () => {
  it("18 doutores (9 PhD level 10 + 9 doutorandos level 7–9), 34 de mestrado (4–6) e 75 de graduação (1–3) — cada um com a sua credencial fictícia", () => {
    expect(DOUTORES_NA_CIDADELA).toBe(18);
    expect(porNivel("phd")).toHaveLength(9); expect(porNivel("doutorando")).toHaveLength(9);
    expect(porNivel("mestrando")).toHaveLength(34);
    // graduação: até 75 — o teto são os lugares das rodas (com 3 supertrees por lote, out/2026, cabem menos)
    expect(porNivel("graduando").length).toBeGreaterThanOrEqual(50); expect(porNivel("graduando").length).toBeLessThanOrEqual(75);
    const ids = new Set([...hier.values()].map((m) => m.credencial.id)); expect(ids.size).toBe(hier.size);   // códigos únicos
    for (const m of hier.values()) {
      expect(m.credencial.ficticia).toBe(true); expect(m.credencial.status).toBe("verificado"); expect(podeFicarNaCidadela(m.credencial)).toBe(true);
      expect(m.credencial.nivelAcademico).toBe(MODELOS_CREDENCIAL[m.credencial.degrau].nivelAcademico);
      expect(LEVELS[m.credencial.degrau]).toContain(m.credencial.level); expect(degrauDoLevel(m.credencial.level)).toBe(m.credencial.degrau);
    }
    expect(hierarquiaDaCidadela(gerarFrota())).not.toBe(hier);   // (outra frota, outro cache — mas os mesmos membros)
    expect([...hierarquiaDaCidadela(gerarFrota()).keys()]).toEqual([...hier.keys()]);
  });
  it("as fileiras: level 10 logo depois dos pilares da capela, depois 7–9, depois 4–6; os level 1–3 nas pontas", () => {
    const r = (n: string) => porNivel(n).map((m) => raio(m.lugar));
    expect(Math.min(...r("phd"))).toBeGreaterThan(CAPELA.r + 4);
    expect(Math.max(...r("phd"))).toBeLessThan(Math.min(...r("doutorando")));
    expect(Math.max(...r("doutorando"))).toBeLessThan(Math.min(...r("mestrando")));
    expect(Math.max(...r("mestrando"))).toBeLessThan(Math.min(...r("graduando")));
    for (const m of porNivel("graduando")) expect(m.lugar.tipo).toBe("piso");
    for (const n of ["phd", "doutorando", "mestrando"]) for (const m of porNivel(n)) expect(m.lugar.tipo).toBe("cabine");
    // todo lugar é único, fica no piso da cidadela e fora de qualquer coisa sólida
    const cs = colisoresDaCidade(), ls = [...hier.values()].map((m) => m.lugar);
    expect(new Set(ls.map((l) => l.id)).size).toBe(ls.length);
    for (const l of ls) { expect(naIlhaPrincipal(l)).toBe(true); expect(alturaNaCidade(l)).toBe(0); for (const c of cs) expect(Math.hypot(l.x - c.x, l.z - c.z)).toBeGreaterThan(c.r - 1e-6); }
  });
  it("as cabines: 52 (9 + 9 + 34), uma por pessoa, sem se encostarem", () => {
    const cs = cabinesDaCidadela(); expect(cs).toHaveLength(FILEIRAS_CABINES.reduce((s, f) => s + f.n, 0)); expect(cs).toHaveLength(52);
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) expect(Math.hypot(cs[i]!.x - cs[j]!.x, cs[i]!.z - cs[j]!.z)).toBeGreaterThan(4);
  });
  it("graduando só fica na cidadela com GRUPO DE ESTUDOS comprovado: cada roda é um grupo, em volta de uma supertree ou atrás das cabines", () => {
    const sem = credencialFicticia({ dono: "x", degrau: "graduando", area: "Direito", seq: 0, sorteio: 1 });
    expect(podeFicarNaCidadela(sem)).toBe(false);
    expect(podeFicarNaCidadela({ ...sem, grupoDeEstudos: { id: "GE-1", nome: "GE Curie", tema: "Direito", membros: 1 } })).toBe(false);
    expect(podeFicarNaCidadela(credencialFicticia({ dono: "y", degrau: "doutorando", area: "Física", seq: 0, sorteio: 3 }))).toBe(true);
    const grupos = new Map<string, string[]>();
    for (const m of porNivel("graduando")) { const g = m.credencial.grupoDeEstudos!; (grupos.get(g.id) ?? grupos.set(g.id, []).get(g.id)!).push(m.agente.id); expect(g.membros).toBeGreaterThanOrEqual(2); }
    for (const [, ids] of grupos) { const gs = new Set(ids.map((id) => hier.get(id)!.agente.grupo)); expect(gs.size).toBe(1); }   // o grupo de estudos = os amigos
    const rodas = rodasDeEstudo(); expect(rodas.filter((r) => r.tipo === "supertree").length).toBe(SUPERTREES.length);   // (3 supertrees em cada um dos 2 lotes do lado do lounge)
    for (const m of porNivel("graduando")) {   // perto de uma supertree ou atrás de uma cabine
      const perto = SUPERTREES.some((t) => Math.hypot(m.lugar.x - mundo(t).x, m.lugar.z - mundo(t).z) < 9) || rodas.some((r) => r.tipo === "cabine" && r.lugares.some((l) => l.id === m.lugar.id));
      expect(perto).toBe(true);
    }
  });
  it("rotina fora do lugar: 30% dos doutores, 70% dos mestrandos e dos graduandos; o resto só fica logado no laboratório", () => {
    const n = (nv: string[]) => [...hier.values()].filter((m) => nv.includes(m.credencial.degrau) && m.rotina).length;
    expect(n(["phd", "doutorando"])).toBe(Math.round(18 * 0.3)); expect(n(["mestrando"])).toBe(Math.round(34 * 0.7)); expect(n(["graduando"])).toBe(Math.round(porNivel("graduando").length * 0.7));
  });
});

describe("os LEVELS da frota inteira", () => {
  it("a regra: 1–3 graduação, 4–6 mestrado, 7–9 doutorado, 10 PhD; o crachá mostra o level (e PhD no 10), nunca o termo antigo", () => {
    expect([1, 2, 3].map(degrauDoLevel)).toEqual(["graduando", "graduando", "graduando"]); expect([4, 5, 6].map(degrauDoLevel)).toEqual(["mestrando", "mestrando", "mestrando"]);
    expect([7, 8, 9].map(degrauDoLevel)).toEqual(["doutorando", "doutorando", "doutorando"]); expect(degrauDoLevel(10)).toBe("phd");
    const c = credencialFicticia({ dono: "z", degrau: "phd", area: "Física", seq: 0, sorteio: 9 }); expect(c.level).toBe(10); expect(nomeComTitulo(c, "Ana Lima")).toBe("Lv 10 · PhD · Ana Lima");
    expect(nomeComTitulo(credencialFicticia({ dono: "w", degrau: "graduando", area: "Direito", seq: 0, sorteio: 5, level: 2 }), "Pedro")).toBe("Lv 2 · Pedro");
  });
  it("toda IA tem credencial com level; fora da cidadela só graduação/mestrado (~22% mestrado), sem grupo de estudos; os 4 levels de cada faixa aparecem", () => {
    const cs = credenciaisDaFrota(frota); expect(cs.size).toBe(frota.length);
    const fora = frota.filter((a) => !hier.has(a.id)).map((a) => cs.get(a.id)!);
    for (const c of fora) { expect(c.level).toBeLessThanOrEqual(6); expect(c.grupoDeEstudos).toBeNull(); expect(podeFicarNaCidadela(c)).toBe(c.degrau !== "graduando"); }   // (graduação sem grupo de estudos não fica)
    const mest = fora.filter((c) => c.degrau === "mestrando").length / fora.length; expect(Math.abs(mest - RESTO_MESTRADO)).toBeLessThan(0.05);
    const vistos = new Set([...cs.values()].map((c) => c.level)); for (let l = 1; l <= 10; l++) expect(vistos.has(l)).toBe(true);
    for (const a of frota) if (hier.has(a.id)) expect(cs.get(a.id)).toBe(hier.get(a.id)!.credencial);
  });
});

describe("a agenda da cidadela", () => {
  const dia = 20734;
  const doutorFixo = [...hier.values()].find((m) => m.credencial.degrau === "doutorando" && !m.rotina)!, mestrRotina = [...hier.values()].find((m) => m.credencial.degrau === "mestrando" && m.rotina)!;
  it("quem só fica logado no laboratório: um bloco, estudando no lugar dele do começo ao fim do dia online", () => {
    const base = agendaBase(doutorFixo.agente, dia, FLAGS_PADRAO, "univ");
    const ag = agendaDaCidadela(doutorFixo, base, dia);
    if (!base.length) { expect(ag).toEqual([]); return; }
    expect(ag).toHaveLength(1); expect(ag[0]).toMatchObject({ atividade: "estudo-plataforma", ambiente: "cidadela", ini: base[0]!.ini, fim: base.at(-1)!.fim });
  });
  it("quem tem rotina: estuda na cidadela na maioria dos blocos e ainda sai (moto/andar)", () => {
    let naCidadela = 0, estudo = 0, fora = 0;
    for (let d = dia; d < dia + 20; d++) {
      const base: Bloco[] = agendaBase(mestrRotina.agente, d, FLAGS_PADRAO, "univ");
      for (const b of agendaDaCidadela(mestrRotina, base, d)) { if (b.atividade.startsWith("estudo")) { estudo++; if (b.ambiente === "cidadela") naCidadela++; } else fora++; }
    }
    expect(naCidadela / estudo).toBeGreaterThan(0.6); expect(naCidadela).toBeLessThan(estudo); expect(fora).toBeGreaterThan(10);
  });
  it("no plano do dia: cada membro senta no SEU lugar (ninguém mais) e aparece lá em status de estudo", () => {
    const plano = planejarDia(frota, dia, FLAGS_PADRAO), donoDoLugar = new Map<string, string>();
    for (const { agente, blocos } of plano.agentes.values()) for (const b of blocos) if (b.ambiente === "cidadela") {
      expect(hier.has(agente.id)).toBe(true); expect(b.spot?.id).toBe(hier.get(agente.id)!.lugar.id);
      const dono = donoDoLugar.get(b.spot!.id); expect(dono === undefined || dono === agente.id).toBe(true); donoDoLugar.set(b.spot!.id, agente.id);
    }
    const f = plano.agentes.get(doutorFixo.agente.id)!; if (!f.blocos.length) return;
    const b = f.blocos[0]!, e = estadoDaIA(doutorFixo.agente.id, f.blocos, (b.ini + b.fim) / 2, FLAGS_PADRAO, false);
    expect(e.visivel).toBe(true); expect(e.pose).toBe("sentado"); expect(Math.hypot(e.x - doutorFixo.lugar.x, e.z - doutorFixo.lugar.z)).toBeLessThan(0.01);
    expect(e.tablet).toBe(0); expect(e.assentoY).toBeGreaterThan(0.4);
    expect(spotsDe("cidadela").length).toBeGreaterThanOrEqual(hier.size);
  });
});
