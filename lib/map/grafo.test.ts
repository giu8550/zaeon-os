import { describe, it, expect } from "vitest";
import {
  nosFromStructured, arestasDoTurno, fundirNoGrafo, projetarCards, cardsAlterados, bussolaDoGrafo,
  setEstado, readNos, readArestas, idDeNo, MAX_NOS_POR_TURNO, MAX_NOS,
} from "@/lib/map/grafo";
import { rascunhosFromStructured } from "@/lib/cartolina/fromStructured";

const ans = (x: any = {}) => ({ nucleo: "n", ...x });
const resposta = ans({
  conceitos: ["Fotossíntese", "Clorofila"],
  evidencia: [{ claim: "A clorofila absorve luz azul e vermelha", source: { title: "Taiz 2017" } }],
  proximos_passos: ["Estudar o ciclo de Calvin"],
  work: { kind: "artigo", sections: [{ title: "Introdução", body: "texto" }] },
  artifacts: [{ studioKind: "mindmap", topic: "fotossíntese" }, { studioKind: "video", topic: "luz" }],
});

describe("nosFromStructured", () => {
  it("mapeia conceitos, evidência, passos, seções e artefatos com estado inicial por tipo", () => {
    const n = nosFromStructured(resposta as any, "m1");
    expect(n.map((x) => x.tipo)).toEqual(["conceito", "conceito", "evidencia", "passo", "secao", "artefato", "artefato"]);
    expect(n.find((x) => x.tipo === "passo")!.estado).toBe("a_conquistar");
    expect(n.find((x) => x.tipo === "conceito")!.estado).toBe("aprendido");
    expect(n.every((x) => x.msgIds[0] === "m1")).toBe(true);
  });
  it("só núcleo → nenhum nó (o grafo não é histórico)", () => expect(nosFromStructured(ans() as any)).toEqual([]));
  it("ids IGUAIS aos cards da cartolina (card.id === nó.id, sem tabela de mapeamento)", () => {
    const nos = nosFromStructured(resposta as any).map((n) => n.id);
    const cards = rascunhosFromStructured(resposta as any).map((c) => c.id);
    expect(nos).toEqual(cards);
  });
  it("id estável: acento/caixa/espaço não criam nó novo", () => {
    expect(idDeNo("conceito", "Fotossíntese")).toBe(idDeNo("conceito", "  fotossintese "));
  });
  it("dedupe + teto por turno", () => {
    const n = nosFromStructured(ans({ conceitos: [...Array(20)].map((_, i) => `c${i}`).concat(["c1"]) }) as any);
    expect(n).toHaveLength(MAX_NOS_POR_TURNO);
    expect(new Set(n.map((x) => x.id)).size).toBe(n.length);
  });
});

describe("arestasDoTurno", () => {
  it("evidência sustenta conceito; conceito leva a passo; seção trata; artefato ilustra; conceitos relacionados", () => {
    const nos = nosFromStructured(resposta as any);
    const a = arestasDoTurno(nos);
    const rel = (r: string) => a.filter((x) => x.relacao === r).length;
    expect(rel("relacionado")).toBe(1);
    expect(rel("sustenta")).toBe(2);
    expect(rel("leva_a")).toBe(2);
    expect(rel("trata")).toBe(2);
    expect(rel("ilustra")).toBe(4);
  });
  it("sem conceitos no turno → sem arestas", () => {
    expect(arestasDoTurno(nosFromStructured(ans({ proximos_passos: ["x"] }) as any))).toEqual([]);
  });
});

describe("fundirNoGrafo", () => {
  it("nó repetido acumula msgIds e não duplica; novo entra; arestas deduplicadas e só entre nós existentes", () => {
    const t1 = nosFromStructured(ans({ conceitos: ["A"] }) as any, "m1");
    const g1 = fundirNoGrafo({ nos: [], arestas: [] }, { nos: t1, arestas: [] });
    expect(g1.novos).toEqual([t1[0]!.id]);
    const t2 = nosFromStructured(ans({ conceitos: ["A", "B"] }) as any, "m2");
    const g2 = fundirNoGrafo(g1, { nos: t2, arestas: [...arestasDoTurno(t2), ...arestasDoTurno(t2), { de: "zzz", para: t2[0]!.id, relacao: "sustenta" }] });
    expect(g2.nos).toHaveLength(2);
    expect(g2.nos[0]!.msgIds).toEqual(["m1", "m2"]);
    expect(g2.tocados).toEqual([t1[0]!.id]);
    expect(g2.novos).toEqual([t2[1]!.id]);
    expect(g2.arestas).toMatchObject([{ de: t2[0]!.id, para: t2[1]!.id, relacao: "relacionado", tipoVisual: "memoria" }]);
  });
  it("estado nunca regride: nó validado continua validado após turno que o cita", () => {
    const t = nosFromStructured(ans({ conceitos: ["A"] }) as any, "m1");
    const g = fundirNoGrafo({ nos: [{ ...t[0]!, estado: "validado" }], arestas: [] }, { nos: t, arestas: [] });
    expect(g.nos[0]!.estado).toBe("validado");
  });
  it("nó planejado (backbone) realizado por um turno perde a marca `planejado` (merge planejado × realizado)", () => {
    const t = nosFromStructured(ans({ conceitos: ["Solo"] }) as any, "m1");
    const g = fundirNoGrafo({ nos: [{ ...t[0]!, msgIds: [], estado: "a_conquistar", planejado: true }], arestas: [] }, { nos: t, arestas: [] });
    expect(g.nos[0]!.planejado).toBeUndefined();
    expect(g.nos[0]!.estado).toBe("aprendido");
    expect(g.nos[0]!.msgIds).toEqual(["m1"]);
  });
  it("teto de nós", () => {
    const muitos = [...Array(MAX_NOS)].map((_, i) => ({ id: `k_${i}`, label: `n${i}`, tipo: "conceito" as const, estado: "aprendido" as const, peso: 0.5, msgIds: [] }));
    const g = fundirNoGrafo({ nos: muitos, arestas: [] }, { nos: nosFromStructured(ans({ conceitos: ["novo"] }) as any), arestas: [] });
    expect(g.nos).toHaveLength(MAX_NOS);
    expect(g.novos).toEqual([]);
  });
});

describe("setEstado", () => {
  const nos = nosFromStructured(ans({ proximos_passos: ["x"] }) as any);
  it("avança, não regride, força quando pedido, null se o nó não existe", () => {
    const ap = setEstado(nos, nos[0]!.id, "aplicado")!;
    expect(ap[0]!.estado).toBe("aplicado");
    expect(setEstado(ap, nos[0]!.id, "aprendido")).toBe(ap);
    expect(setEstado(ap, nos[0]!.id, "aprendido", true)![0]!.estado).toBe("aprendido");
    expect(setEstado(nos, "nada", "aplicado")).toBeNull();
  });
});

describe("projetarCards (grafo → cartolina)", () => {
  it("produz os MESMOS cards que a ponte antiga produziria no 1º turno", () => {
    const nos = nosFromStructured(resposta as any, "m1");
    const cards = projetarCards(nos, []);
    const antigos = rascunhosFromStructured(resposta as any, "m1");
    expect(cards.map((c) => [c.id, c.tipo, c.titulo, c.corpo, c.legenda, c.msgIds])).toEqual(antigos.map((c) => [c.id, c.tipo, c.titulo, c.corpo, c.legenda, c.msgIds]));
    expect(new Set(cards.map((c) => `${c.x},${c.y}`)).size).toBe(cards.length);
  });
  it("card existente é preservado inteiro (posição, texto editado, desenho); só acumula msgId", () => {
    const nos = nosFromStructured(ans({ conceitos: ["A"] }) as any, "m2");
    const atual = [{ id: nos[0]!.id, tipo: "nota" as const, titulo: "A (editado pelo aluno)", x: 777, y: 5, w: 300, msgIds: ["m1"], desenho: { v: 1 } as any }];
    const out = projetarCards(nos, atual);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ titulo: "A (editado pelo aluno)", x: 777, msgIds: ["m1", "m2"], desenho: { v: 1 } });
  });
  it("nó planejado não vira card; nó novo nasce abaixo do conteúdo; nada é removido", () => {
    const atual = [{ id: "velho", tipo: "nota" as const, titulo: "V", x: 0, y: 100, w: 300 }];
    const nos = [...nosFromStructured(ans({ conceitos: ["B"] }) as any), { id: "z_plan", label: "Conclusão", tipo: "conclusao" as const, estado: "a_conquistar" as const, peso: 1, msgIds: [], planejado: true }];
    const out = projetarCards(nos, atual);
    expect(out.map((c) => c.id)).toEqual(["velho", nos[0]!.id]);
    expect(out[1]!.y).toBeGreaterThan(100);
  });
  it("cardsAlterados devolve só o que mudou", () => {
    const nos = nosFromStructured(ans({ conceitos: ["A", "B"] }) as any, "m2");
    const antes = projetarCards(nosFromStructured(ans({ conceitos: ["A"] }) as any, "m1"), []);
    const depois = projetarCards(nos, antes);
    const d = cardsAlterados(antes, depois);
    expect(d.map((c) => c.id).sort()).toEqual([nos[0]!.id, nos[1]!.id].sort());
    expect(cardsAlterados(depois, depois)).toEqual([]);
  });
});

describe("bussolaDoGrafo", () => {
  it("vazia sem nós; separa validado / aplicado / estudado / em aberto / material; respeita teto", () => {
    expect(bussolaDoGrafo([])).toBe("");
    const nos = nosFromStructured(resposta as any);
    const t = bussolaDoGrafo([{ ...nos[0]!, estado: "validado" }, { ...nos[1]!, estado: "aplicado" }, ...nos.slice(2)], { objetivo: "Entender a fotossíntese" });
    expect(t).toMatch(/Objetivo do estudo: Entender/);
    expect(t).toMatch(/Validado: Fotossíntese/);
    expect(t).toMatch(/Aplicado.*Clorofila/);
    expect(t).toMatch(/Em aberto.*Calvin/);
    expect(t).toMatch(/Material criado/);
    const longo = [...Array(200)].map((_, i) => ({ id: `k_${i}`, label: "conceito longo número " + i, tipo: "conceito" as const, estado: "aprendido" as const, peso: 0.5, msgIds: [] }));
    expect(bussolaDoGrafo(longo, { maxChars: 500 }).length).toBeLessThanOrEqual(500);
  });
});

describe("readNos / readArestas (Json do banco)", () => {
  it("descarta lixo, normaliza estado/peso, corta arestas órfãs", () => {
    const nos = readNos([{ id: "k_1", label: "A", tipo: "conceito", estado: "zzz", peso: 9 }, { id: "bad id", label: "x", tipo: "conceito" }, null, { id: "k_2", label: "B", tipo: "nada" }]);
    expect(nos).toHaveLength(1);
    expect(nos[0]).toMatchObject({ estado: "a_conquistar", peso: 1, msgIds: [] });
    expect(readArestas([{ de: "k_1", para: "k_9", relacao: "sustenta" }, { de: "k_1", para: "k_1", relacao: "oops" }], nos)).toEqual([]);
    expect(readNos("x")).toEqual([]);
  });
});
