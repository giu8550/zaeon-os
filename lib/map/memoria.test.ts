import { describe, it, expect } from "vitest";
import { consolidar, atribuirRegioes, recuperarMemoria, textoDeLembrancas, tokens, jaccard, recencia, REGIAO_NOVA } from "@/lib/map/memoria";
import { nosFromStructured, fundirNoGrafo, fundirGavetas, textoDaGaveta, closetDe, readNos, readArestas, arestasDoTurno } from "@/lib/map/grafo";
import { normalizarBackbone } from "@/lib/map/backbone";
import { MAX_DRAWERS_POR_NO, type MapaNo } from "@/lib/map/tipos";

const ans = (x: any = {}) => ({ nucleo: "A clorofila absorve luz.", ...x });
const no = (id: string, label: string, extra: Partial<MapaNo> = {}): MapaNo => ({ id, label, tipo: "conceito", estado: "aprendido", peso: 0.6, msgIds: [], ...extra });

describe("gavetas (verbatim-first) e closet", () => {
  it("cada nó do turno nasce com uma gaveta verbatim (pergunta + núcleo), msgIds, tLast e closet", () => {
    const n = nosFromStructured(ans({ conceitos: ["Clorofila"], proximos_passos: ["Estudar o ciclo de Calvin"] }) as any, "m1", { prompt: "como a planta captura luz?", ts: 1000 });
    expect(n[0]!.drawers).toEqual([{ msgIds: ["m1"], texto: "Aluno: como a planta captura luz?\nAura: A clorofila absorve luz.", ts: 1000 }]);
    expect(n[0]!.tLast).toBe(1000);
    expect(n[0]!.closet).toBe("Clorofila");
    expect(n[1]!.closet).toBe("Estudar o ciclo de Calvin");
    expect(nosFromStructured(ans({ conceitos: ["X"] }) as any, "m1")[0]!.drawers).toBeUndefined(); // sem verbatim = sem gaveta (compat)
  });
  it("gaveta corta no teto; closet corta em 160", () => {
    expect(textoDaGaveta("p".repeat(2000), { nucleo: "n" }).length).toBeLessThanOrEqual(1200);
    expect(closetDe({ label: "x", corpo: "c".repeat(300), legenda: "L" }).length).toBe(160);
  });
  it("fusão acumula gavetas sem duplicar msgId, ordena por ts, teto por nó; tLast = o mais recente", () => {
    const t1 = nosFromStructured(ans({ conceitos: ["A"] }) as any, "m1", { prompt: "p1", ts: 1 });
    const g1 = fundirNoGrafo({ nos: [], arestas: [] }, { nos: t1, arestas: [] });
    const t2 = nosFromStructured(ans({ conceitos: ["A"] }) as any, "m2", { prompt: "p2", ts: 5 });
    const g2 = fundirNoGrafo(g1, { nos: t2, arestas: [] });
    expect(g2.nos[0]!.drawers!.map((d) => d.msgIds[0])).toEqual(["m1", "m2"]);
    expect(g2.nos[0]!.tLast).toBe(5);
    const g3 = fundirNoGrafo(g2, { nos: t2, arestas: [] });
    expect(g3.nos[0]!.drawers).toHaveLength(2);
    const muitas = [...Array(20)].map((_, i) => ({ msgIds: [`m${i}`], texto: "t" + i, ts: i }));
    expect(fundirGavetas([], muitas)).toHaveLength(MAX_DRAWERS_POR_NO);
    expect(fundirGavetas([], muitas).at(-1)!.ts).toBe(19);
  });
  it("leitura do Json preserva gavetas/closet/tLast e tipoVisual/peso das arestas (defaults por relação)", () => {
    const nos = readNos([{ id: "k_1", label: "A", tipo: "conceito", drawers: [{ msgIds: ["m1"], texto: "x", ts: 3 }, { texto: "" }], closet: "c", tLast: 3 }, { id: "k_2", label: "B", tipo: "conceito" }]);
    expect(nos[0]).toMatchObject({ drawers: [{ msgIds: ["m1"], texto: "x", ts: 3 }], closet: "c", tLast: 3 });
    const ar = readArestas([{ de: "k_1", para: "k_2", relacao: "pre_requisito" }, { de: "k_2", para: "k_1", relacao: "relacionado", tipoVisual: "memoria", peso: 0.5 }], nos);
    expect(ar[0]!.tipoVisual).toBe("percurso"); expect(ar[1]).toMatchObject({ tipoVisual: "memoria", peso: 0.5 });
  });
  it("arestas do turno são de MEMÓRIA (azul); as do backbone são de PERCURSO (amarelo)", () => {
    const nos = nosFromStructured(ans({ conceitos: ["A", "B"], evidencia: [{ claim: "c", source: { title: "s" } }] }) as any);
    expect(arestasDoTurno(nos).every((a) => a.tipoVisual === "memoria")).toBe(true);
    const bb = normalizarBackbone({ passos: [{ label: "a" }, { label: "b" }, { label: "c" }] }, "conceitual", [])!;
    expect(bb.arestas.every((a) => a.tipoVisual === "percurso" && a.peso === 1)).toBe(true);
  });
});

describe("consolidar (associações A-MEM, sem LLM)", () => {
  it("liga nós que falam da mesma coisa; ignora pares já ligados e abaixo do limiar", () => {
    const nos = [no("a", "Fotossíntese nas plantas"), no("b", "Plantas e fotossíntese C4"), no("c", "Teoria dos jogos"), no("d", "Fotossíntese", { closet: "Fotossíntese nas plantas" })];
    const novas = consolidar(nos, [{ de: "a", para: "d", relacao: "relacionado" }], ["a"]);
    expect(novas.map((n) => [n.de, n.para])).toEqual([["a", "b"]]);
    expect(novas[0]).toMatchObject({ relacao: "relacionado", tipoVisual: "memoria" });
    expect(novas[0]!.peso).toBeGreaterThan(0.3);
    expect(consolidar(nos, [], ["c"])).toEqual([]);
  });
  it("tokens/jaccard ignoram stopwords e acentos", () => {
    expect([...tokens("A Fotossíntese das plantas")]).toEqual(["fotossintese", "plantas"]);
    expect(jaccard(tokens("fotossíntese plantas"), tokens("plantas fotossintese cloroplasto"))).toBeCloseTo(2 / 3);
  });
});

describe("atribuirRegioes (novas áreas)", () => {
  it("nó alcança o percurso → região do nó do backbone mais próximo; isolado → nova-area", () => {
    const nos = [no("b1", "B1"), no("b2", "B2"), no("x", "X"), no("y", "Y"), no("z", "Z")];
    const ar = [{ de: "b1", para: "b2", relacao: "pre_requisito" as const }, { de: "x", para: "b2", relacao: "sustenta" as const }, { de: "y", para: "x", relacao: "relacionado" as const }];
    const r = atribuirRegioes(nos, ar, ["b1", "b2"]);
    expect(r.map((n) => n.regiao)).toEqual(["b1", "b2", "b2", "b2", REGIAO_NOVA]);
    expect(atribuirRegioes(nos, ar, [])).toBe(nos); // sem backbone não mexe
  });
});

describe("recuperarMemoria (PPR × recência × importância)", () => {
  const agora = 10_000_000_000;
  const nos = [
    no("a", "Fotossíntese", { drawers: [{ msgIds: ["m1"], texto: "Aluno: luz?\nAura: clorofila", ts: agora - 1000 }], tLast: agora - 1000 }),
    no("b", "Ciclo de Calvin", { drawers: [{ msgIds: ["m2"], texto: "calvin", ts: agora - 30 * 86_400_000 }], tLast: agora - 30 * 86_400_000 }),
    no("c", "Teoria dos jogos", { drawers: [{ msgIds: ["m3"], texto: "jogos", ts: agora }], tLast: agora }),
    no("d", "Clorofila", { drawers: [{ msgIds: ["m4"], texto: "clorofila", ts: agora - 1000 }], tLast: agora - 1000 }),
    no("e", "Sem memória"),
  ];
  const ar = [{ de: "a", para: "b", relacao: "leva_a" as const, peso: 0.8 }, { de: "a", para: "d", relacao: "relacionado" as const, peso: 0.6 }];
  it("o que bate na pergunta vem primeiro; vizinhos ligados vêm antes de nós soltos; recência desempata; sem memória e sem match não entra", () => {
    const r = recuperarMemoria(nos, ar, "como funciona a fotossíntese?", { k: 4, agora });
    expect(r[0]!.no.id).toBe("a");
    const ids = r.map((l) => l.no.id);
    expect(ids.indexOf("d")).toBeLessThan(ids.indexOf("c")); // ligado ao assunto > solto
    expect(ids).not.toContain("e");
    expect(r[0]!.porque).toContain("bate na pergunta");
  });
  it("recência: meia-vida de 7 dias; sem tLast = 0.3", () => {
    expect(recencia(agora, agora)).toBe(1); expect(recencia(agora - 7 * 86_400_000, agora)).toBeCloseTo(0.5); expect(recencia(undefined, agora)).toBe(0.3);
  });
  it("texto das lembranças traz closet + gaveta mais recente, com teto", () => {
    const t = textoDeLembrancas(recuperarMemoria(nos, ar, "fotossíntese", { k: 2, agora }));
    expect(t).toMatch(/Memória relevante/); expect(t).toMatch(/Fotossíntese.*gaveta: "Aluno: luz\?/);
    expect(textoDeLembrancas([])).toBe("");
    expect(textoDeLembrancas(recuperarMemoria(nos, ar, "fotossíntese", { k: 4, agora }), 120).length).toBeLessThanOrEqual(120);
  });
  it("sem nós → vazio; pergunta sem match → ainda ranqueia por memória; 'e' sem memória fica fora; a recência desempata nós iguais", () => {
    expect(recuperarMemoria([], [], "x")).toEqual([]);
    const ids = recuperarMemoria(nos, ar, "zzz", { k: 4, agora }).map((l) => l.no.id);
    expect(ids).toHaveLength(4); expect(ids).not.toContain("e");
    const gemeos = [no("velho", "Tema", { drawers: [{ msgIds: [], texto: "v", ts: 1 }], tLast: agora - 60 * 86_400_000 }), no("novo", "Tema", { drawers: [{ msgIds: [], texto: "n", ts: 2 }], tLast: agora })];
    expect(recuperarMemoria(gemeos, [], "zzz", { k: 2, agora })[0]!.no.id).toBe("novo");
  });
});
