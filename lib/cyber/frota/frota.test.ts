import { describe, expect, it } from "vitest";
import { hierarquiaDaCidadela } from "./hierarquia";
import { FROTA_PADRAO, gerarFrota, amigosDe } from "./frota";
import { FLAGS_PADRAO, REGRAS, agendaBase, diaDe, fullNoDia, minutoDoDia, type Bloco } from "./agenda";
import { planejarDia } from "./plano";
import { estadoDaIA, MOV, OFFLINE, pontoDaGaragem, roteiroAndar, roteiroMoto, viagem } from "./corpo";
import { CONVERSA, divaga, episodiosDoDia, limparFala, normalizarFala, promptEpisodio, tomDaResposta, validarFalas } from "./conversas";
import { gerarFalasSemRepetir, gerarResposta, type DepsTexto } from "./texto";
import { CONFIG_PADRAO, aplicarMigracoes, novoLote, sanitizarConfig, totalDaFrota } from "./config";
import { salaDoPonto, spotsDe } from "./lugares";
import { CIDADE, colisoresDaCidade, mundo, salaEm } from "../ceu";

const frota = gerarFrota(), DIA = 20734, plano = planejarDia(frota, DIA, FLAGS_PADRAO);
const dur = (b: Bloco) => b.fim - b.ini;

describe("a frota (700 IAs)", () => {
  it("700, nomes de gente de verdade sem repetir, 60% mulheres, 70% em cloak, grupos de 4", () => {
    expect(frota).toHaveLength(700);
    expect(new Set(frota.map((a) => a.nome)).size).toBe(700);
    expect(new Set(frota.map((a) => a.id)).size).toBe(700);
    expect(frota.filter((a) => a.genero === "f")).toHaveLength(420);
    expect(frota.filter((a) => a.cloak)).toHaveLength(490);
    for (const a of frota) { expect(a.nome).toMatch(/^[\p{L}]+( [\p{L}]+){1,2}$/u); expect(amigosDe(frota, a)).toHaveLength(3); const p = a.nome.split(" "); expect(new Set(p).size).toBe(p.length); }
    expect(gerarFrota()).toEqual(frota);   // determinística
  });
  it("criar em massa acrescenta um lote sem mudar quem já existia", () => {
    const c1 = sanitizarConfig({ frota: { lotes: [{ semente: 2026, total: 300 }], tamanhoGrupo: 4 } }), c2 = novoLote(c1, 100, 777), f2 = gerarFrota(c2.frota);
    expect(totalDaFrota(c2)).toBe(400); expect(f2.slice(0, 300)).toEqual(gerarFrota(c1.frota));
    expect(new Set(f2.map((a) => a.nome)).size).toBe(400);
    expect(Math.min(...f2.slice(300).map((a) => a.grupo))).toBeGreaterThan(Math.max(...f2.slice(0, 300).map((a) => a.grupo)));
  });
  it("a config de fora é saneada (lixo volta ao padrão; limites)", () => {
    const c = sanitizarConfig({ frota: { lotes: [{ semente: 5, total: 99999 }, { semente: "x" }], tamanhoGrupo: 99 }, flags: { moto: false, lixo: 1 }, versao: -3 });
    expect(c.frota.lotes[0]!.total).toBeLessThanOrEqual(2000); expect(c.frota.lotes).toHaveLength(1); expect(c.frota.tamanhoGrupo).toBe(8);
    expect(c.flags.moto).toBe(false); expect(c.flags.estudoPlataforma).toBe(true); expect(c.versao).toBe(1);
    expect(aplicarMigracoes(sanitizarConfig(null)).c).toEqual(CONFIG_PADRAO);
  });
  it("MODO FULL até 12/10: o prazo fecha no fim do dia 12; no modo full ~todo mundo online de madrugada (e sem ele, ninguém)", () => {
    const ate = CONFIG_PADRAO.modoFullAte;
    expect(fullNoDia(diaDe(Date.UTC(2026, 9, 12, 15)), ate)).toBe(true);
    expect(fullNoDia(diaDe(Date.UTC(2026, 9, 13, 4)), ate)).toBe(false);   // 13/10 01h em Fortaleza: acabou
    expect(fullNoDia(DIA, null)).toBe(false);
    const turma = frota.slice(0, 200), full = planejarDia(turma, DIA, FLAGS_PADRAO, true), normal = planejarDia(turma, DIA, FLAGS_PADRAO, false);
    const online = (p: typeof full, m: number) => [...p.agentes.values()].filter(({ agente, blocos }) => estadoDaIA(agente.id, blocos, m, FLAGS_PADRAO, true, false).visivel).length;
    expect(online(full, 3 * 60)).toBeGreaterThan(turma.length * 0.85); expect(online(normal, 3 * 60)).toBe(0);
    expect(online(full, 15 * 60)).toBeGreaterThan(turma.length * 0.85);
  });
  it("TETO 500 (out/2026, fps): toda config vira o lote de sempre (2026) com 500 — a nova, a de 2000 e a de PROD (700 + 800) dão a MESMA frota", () => {
    const antes = gerarFrota({ lotes: [{ semente: 2026, total: 500, fracaoMulheres: 0.6, fracaoCloak: 0.7 }], tamanhoGrupo: 4 }).map((a) => a.nome);
    for (const salva of [
      { frota: { lotes: [{ semente: 2026, total: 700 }], tamanhoGrupo: 4 }, flags: {}, versao: 1 },
      { frota: { lotes: [{ semente: 2026, total: 700 }, { semente: 2027, total: 1300 }], tamanhoGrupo: 4 }, flags: {}, versao: 7, migracoes: ["2026-10-mais-1300", "2026-10-modo-full-ate-12"] },
      { frota: { lotes: [{ semente: 2026, total: 700 }, { semente: 2027, total: 800 }], tamanhoGrupo: 4 }, flags: {}, versao: 9, migracoes: ["2026-10-mais-1300", "2026-10-modo-full-ate-12", "2026-10-teto-1500", "2026-10-teto-1000"] },
    ]) {
      const m = aplicarMigracoes(sanitizarConfig(salva));
      expect(m.c.frota.lotes.map((l) => [l.semente, l.total])).toEqual([[2026, 500]]); expect(m.mudou).toBe(true);
      expect(gerarFrota(m.c.frota).map((a) => a.nome)).toEqual(antes);
      expect(aplicarMigracoes(m.c).mudou).toBe(false);
    }
    expect(totalDaFrota(CONFIG_PADRAO)).toBe(500);
    expect(totalDaFrota(novoLote(CONFIG_PADRAO, 50, 9))).toBe(500);   // no teto: criar mais não passa de 500
  });
});

describe("a agenda do dia", () => {
  const todos = [...plano.agentes.values()];
  it("começa a partir das 9h; estuda de 5 a 8 h; intervalos de 30 a 60 min entre os estudos", () => {
    const hier = hierarquiaDaCidadela(frota);
    for (const { agente, blocos } of todos) {
      if (!blocos.length) continue;
      expect(blocos[0]!.ini).toBeGreaterThanOrEqual(REGRAS.inicio);
      if (hier.get(agente.id)?.rotina === false) continue;   // (só logado no laboratório: um bloco o dia online inteiro — lib/cyber/frota/hierarquia.test)
      const estudo = blocos.filter((b) => b.atividade.startsWith("estudo")).reduce((s, b) => s + dur(b), 0);
      expect(estudo).toBeGreaterThanOrEqual(REGRAS.estudoMin - 6); expect(estudo).toBeLessThanOrEqual(REGRAS.estudoMax + 1);
      for (const b of blocos.filter((x) => (x.atividade === "moto" || x.atividade === "andar") && !x.evento)) { expect(dur(b)).toBeGreaterThanOrEqual(REGRAS.intervalo[0] - 1e-6); expect(dur(b)).toBeLessThanOrEqual(REGRAS.intervalo[1] + 1e-6); }   // (minutos em ponto flutuante)
      for (let i = 1; i < blocos.length; i++) expect(blocos[i]!.ini).toBeGreaterThanOrEqual(blocos[i - 1]!.ini);
      void agente;
    }
  });
  it("a proporção: ~58% estudo nas plataformas, ~8% no lounge, ~30% moto, ~5% andando (pouco pedestre na Zaeon)", () => {
    const t: Record<string, number> = {}; let total = 0;
    for (const { blocos } of todos) for (const b of blocos) if (b.atividade !== "festa") { t[b.atividade] = (t[b.atividade] ?? 0) + dur(b); total += dur(b); }
    const pct = (k: string) => (100 * (t[k] ?? 0)) / total;
    expect(pct("estudo-plataforma")).toBeGreaterThan(52); expect(pct("estudo-plataforma")).toBeLessThan(64);
    expect(pct("estudo-lounge")).toBeGreaterThan(4); expect(pct("estudo-lounge")).toBeLessThan(11);
    expect(pct("moto")).toBeGreaterThan(24); expect(pct("moto")).toBeLessThan(35);
    expect(pct("andar")).toBeGreaterThan(2); expect(pct("andar")).toBeLessThan(8);
  });
  it("sem universidades no mapa, o estudo é todo na Zaeon (biblioteca, jardim, lounge e a cidadela)", () => {
    let zaeon = 0, total = 0;
    for (const { blocos } of todos) for (const b of blocos) if (b.atividade.startsWith("estudo") && b.spot) { total += dur(b); if (["biblioteca", "jardim", "lounge", "cidadela"].includes(b.ambiente!)) zaeon += dur(b); }
    expect(total).toBeGreaterThan(0); expect(zaeon / total).toBe(1);
  });
  it("as MULHERES tendem a estudar mais que os homens", () => {
    const media = (g: "f" | "m") => { const l = todos.filter((x) => x.agente.genero === g && x.blocos.length).map((x) => x.blocos.filter((b) => b.atividade.startsWith("estudo")).reduce((s, b) => s + dur(b), 0)); return l.reduce((s, v) => s + v, 0) / l.length; };
    expect(media("f")).toBeGreaterThan(media("m") + 15);
  });
  it("cada IA tem o seu ritmo e ele varia de um dia pro outro", () => {
    const a = frota[0]!, d1 = agendaBase(a, DIA, FLAGS_PADRAO, "biblioteca"), d2 = agendaBase(a, DIA + 1, FLAGS_PADRAO, "biblioteca");
    expect(d1).not.toEqual(d2);
    expect(new Set(todos.map((x) => x.blocos[0]?.ini ?? -1)).size).toBeGreaterThan(300);   // cada uma começa numa hora
  });
  it("as chaves desligam as atividades (sem moto → ninguém anda de moto; desligada → ninguém)", () => {
    const sem = planejarDia(frota.slice(0, 80), DIA, { ...FLAGS_PADRAO, moto: false });
    for (const { blocos } of sem.agentes.values()) expect(blocos.some((b) => b.atividade === "moto")).toBe(false);
    const off = planejarDia(frota.slice(0, 20), DIA, { ...FLAGS_PADRAO, ativa: false });
    for (const { blocos } of off.agentes.values()) expect(blocos).toHaveLength(0);
  });
  it("eventos em GRUPO: corridas de moto (dupla ou bando) e a festa no lounge (todos do grupo juntos)", () => {
    const eventos = new Map<string, Set<number>>();
    for (const { agente, blocos } of todos) for (const b of blocos) if (b.evento) (eventos.get(b.evento) ?? eventos.set(b.evento, new Set()).get(b.evento)!).add(agente.grupo);
    expect([...eventos.keys()].some((k) => k.startsWith("corrida"))).toBe(true);
    expect([...eventos.keys()].some((k) => k.startsWith("festa"))).toBe(true);
    for (const g of eventos.values()) expect(g.size).toBe(1);   // evento é coisa do grupo
    for (const [k] of eventos) { const n = todos.filter((x) => x.blocos.some((b) => b.evento === k)).length; expect(n).toBeGreaterThanOrEqual(2); }
  });
});

describe("os lugares (ninguém senta no colo de ninguém)", () => {
  it("no mesmo spot, nunca duas IAs ao mesmo tempo; quem deita ocupa o sofá todo", () => {
    const uso = new Map<string, [number, number][]>();
    for (const { blocos } of plano.agentes.values()) for (const b of blocos) if (b.spot) {
      for (const id of [b.spot.id, ...(b.deitado && b.spot.par ? [b.spot.par] : [])]) (uso.get(id) ?? uso.set(id, []).get(id)!).push([b.ini, b.fim]);
    }
    for (const l of uso.values()) { l.sort((x, y) => x[0] - y[0]); for (let i = 1; i < l.length; i++) expect(l[i]![0]).toBeGreaterThanOrEqual(l[i - 1]![1] - 1e-9); }
  });
  it("os spots das salas da Zaeon ficam dentro da sala; o lounge (estudo) começa pelos sofás", () => {
    for (const amb of ["biblioteca", "jardim", "lounge"] as const) for (const s of spotsDe(amb)) expect(salaEm({ x: s.x - CIDADE.centro.x, z: s.z - CIDADE.centro.z })).toBe(amb === "lounge" ? "lounge" : amb);
    expect(spotsDe("lounge")[0]!.tipo).not.toBe("piso");
    expect(spotsDe("univ").length).toBeGreaterThan(50);
  });
});

describe("o corpo no instante", () => {
  const est = (id: string, m: number) => { const p = plano.agentes.get(id)!; return estadoDaIA(id, p.blocos, m, FLAGS_PADRAO, true); };
  it("de madrugada ninguém; à tarde a maioria; posições sempre finitas; estudando = tablet na mão e sentado", () => {
    let on = 0, tablet = 0;
    for (const a of frota) {
      expect(est(a.id, 4 * 60)).toEqual(OFFLINE);
      const e = est(a.id, 15 * 60 + 17);
      if (!e.visivel) continue; on++;
      expect(Number.isFinite(e.x + e.y + e.z + e.rumo)).toBe(true);
      const naCabine = e.ambiente === "cidadela" && e.pose === "sentado";   // (na cabine da cidadela: o monitor, sem tablet)
      if (!naCabine && e.atividade?.startsWith("estudo") && ["sentado", "relaxa", "chao", "deitado"].includes(e.pose) && e.sentar > 0.99) { expect(e.tablet).toBeGreaterThan(0.99); tablet++; }
    }
    expect(on).toBeGreaterThan(450); expect(tablet).toBeGreaterThan(150);
  });
  it("a festa só acontece com SOM rolando", () => {
    const x = [...plano.agentes.values()].find((p) => p.blocos.some((b) => b.atividade === "festa"))!, b = x.blocos.find((b) => b.atividade === "festa")!, m = (b.ini + b.fim) / 2;
    expect(estadoDaIA(x.agente.id, x.blocos, m, FLAGS_PADRAO, true).pose).toBe("danca");
    expect(estadoDaIA(x.agente.id, x.blocos, m, FLAGS_PADRAO, false).visivel).toBe(false);
  });
  it("viagens: dentro da Zaeon de MOCHILA; pra fora de MOTO PEGA NA GARAGEM (nada de moto saindo de sala); contínuo", () => {
    const de = { x: mundo({ x: 30, z: 0 }).x, y: CIDADE.pisoY, z: mundo({ x: 30, z: 0 }).z }, sala = mundo(CIDADE.salas.biblioteca);
    expect(viagem(de, { x: sala.x, y: CIDADE.pisoY + 88, z: sala.z }, FLAGS_PADRAO, "t").modo).toBe("mochila");
    const univ = spotsDe("univ")[0]!, v = viagem(de, univ, FLAGS_PADRAO, "t2"), g = pontoDaGaragem("t2");
    expect(v.em(0.02).modo).toBe("mochila");   // sai de mochila…
    expect(v.em(0.98).modo).toBe("moto");      // …e chega de moto
    // a troca (mochila → moto) acontece NA garagem
    let troca: { x: number; z: number } | null = null; for (let u = 0; u <= 1 && !troca; u += 0.001) { const p = v.em(u); if (p.modo === "moto") troca = p; }
    expect(Math.hypot(troca!.x - g.x, troca!.z - g.z)).toBeLessThan(1);
    expect(salaDoPonto(g)).toBe("garagem");
    // e o caminho de volta: pousa a moto na garagem e segue de mochila
    const volta = viagem(univ, de, FLAGS_PADRAO, "t3"); expect(volta.em(0.02).modo).toBe("moto"); expect(volta.em(0.98).modo).toBe("mochila");
    let ant = v.em(0);
    for (let u = 0.01; u <= 1; u += 0.01) { const p = v.em(u); expect(Math.hypot(p.x - ant.x, p.y - ant.y, p.z - ant.z)).toBeLessThan(MOV.moto * v.dur * 0.02 + 60); ant = p; }   // (+ a descida da moto até a UNILAB, ~300 m em 5 s)
    expect(Math.hypot(v.em(1).x - univ.x, v.em(1).z - univ.z)).toBeLessThan(0.01);
  });
  it("uma Zaeon VIVA: de moto, a maior parte do tempo VOANDO; a pé, a maior parte PARADO num ponto de interesse (não vagando)", () => {
    const n = { moto: 0, motoMove: 0, andar: 0, andarMove: 0 };
    for (let m = 9 * 60; m < 22 * 60; m += 11) for (const { agente, blocos } of plano.agentes.values()) {
      const e = estadoDaIA(agente.id, blocos, m, FLAGS_PADRAO, true, false); if (!e.visivel) continue;
      if (e.atividade === "moto") { n.moto++; if (["moto", "mochila"].includes(e.pose)) n.motoMove++; }
      if (e.atividade === "andar") { n.andar++; if (["andando", "mochila"].includes(e.pose)) n.andarMove++; }
    }
    expect(n.motoMove / n.moto).toBeGreaterThan(0.8);
    expect(n.andarMove / n.andar).toBeLessThan(0.35);
  });
  it("a pé, a TURMA fica junta num ponto de interesse (telão ou salão), cada um virado pro que está vendo", () => {
    const amostra = [...plano.agentes.values()].flatMap(({ agente, blocos }) => blocos.map((b, i) => ({ agente, b, i })).filter((x) => x.b.atividade === "andar")).slice(0, 300);
    expect(amostra.length).toBeGreaterThan(50);
    for (const { agente, b, i } of amostra) {
      const rot = roteiroAndar(b, agente.id, i);
      expect(rot.length).toBeGreaterThanOrEqual(2);
      for (const p of rot) { expect(p.id).toMatch(/^(telao-(problemas|solucoes)-[0-3]|salao)#/); expect(p.fica!).toBeGreaterThanOrEqual(180); }
    }
    // dois amigos passeando no mesmo pedaço do dia vão aos MESMOS pontos, a poucos metros um do outro
    const porTurma = new Map<string, typeof amostra>();
    for (const x of amostra) { const k = `${x.b.turma}|${Math.floor(x.b.ini / 40)}`; porTurma.set(k, [...(porTurma.get(k) ?? []), x]); }
    let pares = 0;
    for (const l of porTurma.values()) if (l.length > 1) {
      const [a, c] = [roteiroAndar(l[0]!.b, l[0]!.agente.id, l[0]!.i), roteiroAndar(l[1]!.b, l[1]!.agente.id, l[1]!.i)];
      expect(a.map((p) => p.id)).toEqual(c.map((p) => p.id));
      expect(Math.hypot(a[0]!.x - c[0]!.x, a[0]!.z - c[0]!.z)).toBeLessThan(10.5);
      pares++;
    }
    expect(pares).toBeGreaterThan(0);
  });
  it("os lugares da plateia não caem dentro de nada sólido (palco, cards, árvores, pilares, globo)", () => {
    const cs = colisoresDaCidade();
    for (const { agente, blocos } of [...plano.agentes.values()].slice(0, 400)) blocos.forEach((b, i) => {
      if (b.atividade !== "andar") return;
      for (const p of roteiroAndar(b, agente.id, i)) for (const c of cs) expect(Math.hypot(p.x - c.x, p.z - c.z), `${p.id} em ${c.x.toFixed(0)},${c.z.toFixed(0)}`).toBeGreaterThan(c.r + 0.3);
    });
  });
  it("o passeio de moto e a pé: contínuos (sem teleporte de um minuto pro outro)", () => {
    const amostra = [...plano.agentes.values()].filter((p) => p.blocos.some((b) => b.atividade === "moto" || b.atividade === "andar")).slice(0, 40);
    for (const { agente, blocos } of amostra) for (const b of blocos.filter((x) => x.atividade === "moto" || x.atividade === "andar")) {
      let ant = estadoDaIA(agente.id, blocos, b.ini + 0.01, FLAGS_PADRAO, true, false);
      for (let m = b.ini + 0.01 + 1 / 60; m < b.fim - 0.02; m += 1 / 60) {   // a cada segundo
        const e = estadoDaIA(agente.id, blocos, m, FLAGS_PADRAO, true, false);
        if (e.visivel && ant.visivel) expect(Math.hypot(e.x - ant.x, e.y - ant.y, e.z - ant.z), `${agente.id} ${b.atividade} ${m.toFixed(2)}`).toBeLessThan(MOV.moto * 1.4 + 15);   // (a moto no ritmo mais rápido)
        ant = e;
      }
    }
  });
  it("ninguém EMPILHADO: em qualquer minuto, IAs paradas/estudando visíveis não dividem o mesmo ponto (< 0,6 m)", () => {
    for (const m of [10 * 60, 14 * 60 + 17, 18 * 60 + 41]) {
      const pts: { x: number; z: number; y: number }[] = [];
      for (const { agente, blocos } of plano.agentes.values()) { const e = estadoDaIA(agente.id, blocos, m, FLAGS_PADRAO, true, false); if (e.visivel && !["moto", "mochila", "andando"].includes(e.pose)) pts.push(e); }
      const grade = new Map<string, number>(); let colisoes = 0;
      for (const p of pts) { const k = `${Math.round(p.x / 0.6)},${Math.round(p.z / 0.6)},${Math.round(p.y)}`; const n = grade.get(k) ?? 0; if (n) colisoes++; grade.set(k, n + 1); }
      expect(colisoes / pts.length).toBeLessThan(0.03);
    }
  });
  it("o passeio de moto visita lugares FORA da cidadela (a volta dentro dela não passa de 2 min) — a Solana House e a praça ficam pertinho, a 70–100 m da borda", () => {
    for (const { agente, blocos } of [...plano.agentes.values()].slice(0, 120)) blocos.forEach((b, i) => {
      if (b.atividade !== "moto") return;
      for (const p of roteiroMoto(b, agente.id, i)) expect(Math.hypot(p.p.x - CIDADE.centro.x, p.p.z - CIDADE.centro.z)).toBeGreaterThan(CIDADE.bordaR + 30);
    });
    expect(MOV.rodaZaeonMax).toBeLessThanOrEqual(120);
  });
  it("o relógio: dia e minuto na hora de Fortaleza", () => {
    const t = Date.UTC(2026, 9, 8, 15, 30);   // 12:30 em Fortaleza
    expect(minutoDoDia(t)).toBeCloseTo(12 * 60 + 30, 6); expect(diaDe(t)).toBe(Math.floor((t - 3 * 3600000) / 86400000));
  });
});

describe("as conversas", () => {
  const eps = episodiosDoDia(plano, FLAGS_PADRAO), porId = new Map(frota.map((a) => [a.id, a]));
  it("só entre amigos do MESMO grupo, de 2 a 8 falas, ninguém fala duas vezes seguidas", () => {
    expect(eps.length).toBeGreaterThan(500);
    for (const e of eps) {
      expect(e.falas.length).toBeGreaterThanOrEqual(CONVERSA.falasMin); expect(e.falas.length).toBeLessThanOrEqual(CONVERSA.falasMax);
      for (const f of e.falas) expect(porId.get(f.agente)!.grupo).toBe(e.grupo);
      for (let i = 1; i < e.falas.length; i++) { expect(e.falas[i]!.agente).not.toBe(e.falas[i - 1]!.agente); expect(e.falas[i]!.em).toBeGreaterThan(e.falas[i - 1]!.em); }
    }
  });
  it("acontecem onde estão JUNTOS: estudando, na corrida e na festa", () => {
    const ctx = new Set(eps.map((e) => e.contexto));
    expect(ctx.has("estudo")).toBe(true); expect(ctx.has("corrida")).toBe(true); expect(ctx.has("festa")).toBe(true);
  });
  it("só ~30% das IAs foge do assunto (estudo/trabalho/pesquisa)", () => {
    const fr = frota.filter(divaga).length / frota.length; expect(fr).toBeGreaterThan(0.24); expect(fr).toBeLessThan(0.36);
    for (const e of eps.filter((x) => x.foraDoTema)) expect(divaga(porId.get(e.falas[0]!.agente)!)).toBe(true);
  });
  it("cloak: as falas de quem está em cloak não têm texto; sem cloak (chave) todas têm", () => {
    for (const e of eps) for (const f of e.falas) expect(f.cloak).toBe(porId.get(f.agente)!.cloak);
    const sem = episodiosDoDia(plano, { ...FLAGS_PADRAO, cloak: false }); for (const e of sem) for (const f of e.falas) expect(f.cloak).toBe(false);
  });
  it("o prompt traz os nomes, o lugar e uma direção por fala; o JSON da IA é validado e limpo", () => {
    const e = eps.find((x) => x.falas.length >= 3)!, p = promptEpisodio(e, (id) => porId.get(id));
    expect(p.user).toContain(porId.get(e.falas[0]!.agente)!.nome.split(" ")[0]); expect(p.system).toMatch(/NUNCA mencione/);
    expect(validarFalas({ falas: ["Ana: oi gente", "  \"bora estudar\" "] }, 2)).toEqual(["oi gente", "bora estudar"]);
    expect(validarFalas({ falas: ["só uma"] }, 2)).toBeNull();
    expect(limparFala("Pedro: kkkk")).toBe("kkkk");
  });
});

describe("regra de ouro: NADA se repete", () => {
  const ep = episodiosDoDia(plano, { ...FLAGS_PADRAO, cloak: false }).find((e) => e.falas.length === 4)!;
  const porId = new Map(frota.map((a) => [a.id, a]));
  function memoria(vistasIniciais: string[] = []) {
    const vistas = new Set(vistasIniciais.map(normalizarFala));
    return {
      vistas,
      jaVistas: async (imps: string[]) => new Set(imps.filter((i) => vistas.has(i))),
      anotar: async (imps: string[]) => { const ja = new Set<string>(); for (const i of imps) { if (vistas.has(i)) ja.add(i); vistas.add(i); } return ja; },
    };
  }
  it("a impressão ignora maiúscula, acento e pontuação", () => {
    expect(normalizarFala("Bora ESTUDAR, Fí!! 📚")).toBe(normalizarFala("bora estudar fi"));
  });
  it("a fala que já foi vista é REESCRITA; a repetida dentro do episódio também", async () => {
    const m = memoria(["vixe essa prova"]); let k = 0;
    const deps: DepsTexto = { ...m, ia: async (p) => (p.user.startsWith("fala:") ? { fala: `outra versão ${++k}` } : { falas: ["vixe essa prova", "kkkk real", "kkkk real", "partiu"] }) };
    const out = await gerarFalasSemRepetir(ep, (id) => porId.get(id), deps);
    const imps = out.map((f) => normalizarFala(f!));
    expect(new Set(imps).size).toBe(4); expect(imps).not.toContain(normalizarFala("vixe essa prova"));
    for (const i of imps) expect(m.vistas.has(i)).toBe(true);   // anotadas
  });
  it("se não sai sem repetir, a fala fica sem texto (nunca mostra repetida)", async () => {
    const m = memoria(["sempre igual"]);
    const deps: DepsTexto = { ...m, ia: async (p) => (p.user.startsWith("fala:") ? { fala: "sempre igual" } : { falas: ["sempre igual", "a", "b", "c"] }) };
    const out = await gerarFalasSemRepetir(ep, (id) => porId.get(id), deps);
    expect(out[0]).toBeNull();
  });
  it("respostas a usuários: seca → corta → ignora; também sem repetir", async () => {
    expect([1, 2, 3, 4, 5, 9].map(tomDaResposta)).toEqual(["seco", "seco", "corta", "corta", "ignora", "ignora"]);
    const m = memoria(["iae"]); let k = 0;
    const deps: DepsTexto = { ...m, ia: async (p) => (p.user.startsWith("fala:") ? { fala: `opa ${++k}` } : { fala: "iae" }) };
    const a = frota.find((x) => !x.cloak)!;
    expect(normalizarFala((await gerarResposta(a, "seco", "oi tudo bem?", 1, deps))!)).not.toBe("iae");
    expect(await gerarResposta(a, "ignora", "oi", 2, deps)).toBeNull();
  });
});
