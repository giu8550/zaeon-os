import { describe, it, expect, vi } from "vitest";
import { topicSlug, topicLabel, MASTERY_THRESHOLD, type SkillNode } from "./types";
import { sanitizeTree, fallbackTree, hasCycle, hasAllBranches, generateSkillTree, SKILLTREE_SYSTEM } from "./generate";
import { computeStates, nextNodes, mirrorSkills, treeContextText, clamp01 } from "./progress";
import { deltaFromScore, isAttempt, sanitizeAssessment } from "./assess";

const GOOD = {
  nodes: [
    { id: "fund", title: "Fundamentos", branch: "teoria", level: 1, prereqs: [], summary: "Base." },
    { id: "luz", title: "Luz e pigmentos", branch: "teoria", level: 2, prereqs: ["fund"], summary: "" },
    { id: "medir", title: "Medir taxa", branch: "experimental", level: 2, prereqs: ["fund"], summary: "" },
    { id: "ciclo", title: "Ciclo de Calvin", branch: "teoria", level: 3, prereqs: ["luz"], summary: "" },
    { id: "exp-o2", title: "Experimento O2", branch: "experimental", level: 3, prereqs: ["medir", "luz"], summary: "" },
    { id: "aplicar", title: "Aplicar em cultivo", branch: "pratica", level: 4, prereqs: ["ciclo", "exp-o2"], summary: "" },
  ],
};

describe("topicSlug", () => {
  it("normaliza acentos, caixa e espaços", () => {
    expect(topicSlug("Fotossíntese em C4 ")).toBe("fotossintese-em-c4");
    expect(topicSlug("  Redes Neurais: Backprop!  ")).toBe("redes-neurais-backprop");
    expect(topicLabel("  a   b ")).toBe("a b");
  });
  it("é estável (mesmo tópico → mesmo slug = mesma árvore no cache)", () => {
    expect(topicSlug("FOTOSSÍNTESE")).toBe(topicSlug("fotossintese"));
  });
});

describe("sanitizeTree", () => {
  it("aceita um grafo válido com os 3 ramos e ordena por level", () => {
    const nodes = sanitizeTree(GOOD)!;
    expect(nodes).toHaveLength(6);
    expect(hasAllBranches(nodes)).toBe(true);
    expect(hasCycle(nodes)).toBe(false);
    expect(nodes.map((n) => n.level)).toEqual([1, 2, 2, 3, 3, 4]);
  });
  it("rejeita quando falta um ramo (gate: 3 ramos)", () => {
    const only = { nodes: GOOD.nodes.map((n) => ({ ...n, branch: "teoria" })) };
    expect(sanitizeTree(only)).toBeNull();
  });
  it("rejeita poucos nós ou JSON sem shape", () => {
    expect(sanitizeTree({ nodes: GOOD.nodes.slice(0, 3) })).toBeNull();
    expect(sanitizeTree({ foo: 1 })).toBeNull();
    expect(sanitizeTree(null)).toBeNull();
  });
  it("quebra ciclos e referências inválidas (prereq deve ter level menor e existir)", () => {
    const cyc = {
      nodes: [
        ...GOOD.nodes,
        { id: "fund", title: "dup", branch: "teoria", level: 1, prereqs: ["aplicar", "nao-existe", "fund"], summary: "" },
      ],
    };
    const nodes = sanitizeTree(cyc)!;
    expect(hasCycle(nodes)).toBe(false);
    const dup = nodes.find((n) => n.title === "dup")!;
    expect(dup.id).toBe("fund-2"); // id duplicado ganha sufixo
    expect(dup.prereqs).toEqual([]);  // nível 1 não pode ter prereq; refs inválidas caem
  });
  it("mapeia aliases de ramo e normaliza level fora da faixa", () => {
    const raw = { nodes: GOOD.nodes.map((n, i) => ({ ...n, branch: i === 0 ? "Teórico" : i === 2 ? "Experimento" : i === 5 ? "Prática" : n.branch, level: i === 5 ? 99 : n.level })) };
    const nodes = sanitizeTree(raw)!;
    expect(nodes.find((n) => n.id === "fund")!.branch).toBe("teoria");
    expect(nodes.find((n) => n.id === "medir")!.branch).toBe("experimental");
    expect(nodes.find((n) => n.id === "aplicar")!.branch).toBe("pratica");
    expect(nodes.find((n) => n.id === "aplicar")!.level).toBe(8);
  });
});

describe("hasCycle", () => {
  it("detecta ciclo direto", () => {
    expect(hasCycle([{ id: "a", prereqs: ["b"] }, { id: "b", prereqs: ["a"] }])).toBe(true);
    expect(hasCycle([{ id: "a", prereqs: [] }, { id: "b", prereqs: ["a"] }])).toBe(false);
  });
});

describe("fallbackTree", () => {
  it("é uma trilha linear de 5 nós de teoria com ids estáveis", () => {
    const t = fallbackTree("Fotossíntese");
    expect(t).toHaveLength(5);
    expect(t.every((n) => n.branch === "teoria")).toBe(true);
    expect(t.map((n) => n.id)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
    expect(t[3].prereqs).toEqual(["t3"]);
    expect(hasCycle(t)).toBe(false);
  });
});

describe("generateSkillTree (genJson injetado)", () => {
  it("usa o system prompt e retorna nós válidos sem retry", async () => {
    const gen = vi.fn().mockResolvedValue(GOOD);
    const r = await generateSkillTree("Fotossíntese", gen as any);
    expect(gen).toHaveBeenCalledTimes(1);
    expect(gen.mock.calls[0][0]).toBe(SKILLTREE_SYSTEM);
    expect(r.nodes).toHaveLength(6);
  });
  it("faz 1 retry quando a 1ª saída é inválida e lança se a 2ª também for", async () => {
    const gen = vi.fn().mockResolvedValueOnce({ nodes: [] }).mockResolvedValueOnce(GOOD);
    const r = await generateSkillTree("x", gen as any);
    expect(gen).toHaveBeenCalledTimes(2);
    expect(r.nodes.length).toBe(6);
    const bad = vi.fn().mockResolvedValue({ nodes: [] });
    await expect(generateSkillTree("x", bad as any)).rejects.toThrow("skilltree_invalid");
  });
});

describe("computeStates / desbloqueio", () => {
  const nodes = sanitizeTree(GOOD)!;
  it("raízes começam available e o resto locked", () => {
    const st = computeStates(nodes, {});
    expect(st.find((s) => s.id === "fund")!.status).toBe("available");
    expect(st.filter((s) => s.status === "locked").map((s) => s.id).sort()).toEqual(["aplicar", "ciclo", "exp-o2", "luz", "medir"]);
  });
  it("dominar um nó (≥ limiar) libera SÓ os nós cujos prereqs estão todos dominados", () => {
    const st = computeStates(nodes, { fund: MASTERY_THRESHOLD });
    expect(st.find((s) => s.id === "fund")!.status).toBe("mastered");
    expect(st.find((s) => s.id === "luz")!.status).toBe("available");
    expect(st.find((s) => s.id === "medir")!.status).toBe("available");
    expect(st.find((s) => s.id === "exp-o2")!.status).toBe("locked"); // precisa de medir E luz
    const st2 = computeStates(nodes, { fund: 1, luz: 1, medir: 0.5 });
    expect(st2.find((s) => s.id === "medir")!.status).toBe("in_progress");
    expect(st2.find((s) => s.id === "exp-o2")!.status).toBe("locked");
    expect(st2.find((s) => s.id === "ciclo")!.status).toBe("available");
  });
  it("nextNodes prioriza em andamento e depois o mais básico", () => {
    const st = computeStates(nodes, { fund: 1, luz: 0.3 });
    expect(nextNodes(st).map((s) => s.id)).toEqual(["luz", "medir"]);
  });
  it("clamp01 protege contra NaN e fora de faixa", () => {
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
  });
});

describe("mirrorSkills (RPG)", () => {
  it("preserva as skills existentes e sobe o rank por nós dominados", () => {
    const base = { writing: { rank: "F", current: 0, next: 5, metricName: "Papers" } };
    expect(mirrorSkills(base, 0)).toMatchObject({ writing: base.writing, mastery: { rank: "F", current: 0, next: 3 } });
    expect((mirrorSkills(null, 9) as any).mastery).toMatchObject({ rank: "D", current: 9, next: 15 });
    expect((mirrorSkills(undefined, 150) as any).mastery).toMatchObject({ rank: "SS", current: 150 });
  });
});

describe("treeContextText (mentor)", () => {
  it("cita dominados, disponíveis, o nó em foco e o guardrail pedagógico", () => {
    const st = computeStates(sanitizeTree(GOOD)!, { fund: 1 });
    const txt = treeContextText("Fotossíntese", st, "luz");
    expect(txt).toContain('ÁRVORE DE HABILIDADES do tópico "Fotossíntese"');
    expect(txt).toContain("Dominados (1/6): Fundamentos");
    expect(txt).toContain("Disponíveis agora: Luz e pigmentos; Medir taxa");
    expect(txt).toContain('NÓ EM FOCO: "Luz e pigmentos"');
    expect(txt).toContain("GUARDRAIL PEDAGÓGICO");
  });
});

describe("assess (puro)", () => {
  it("só julga tentativas (≥ 6 palavras)", () => {
    expect(isAttempt("o que é fotossíntese?")).toBe(false);
    expect(isAttempt("a clorofila absorve luz e converte CO2 e água em glicose")).toBe(true);
  });
  it("score → delta: 2 boas demonstrações dominam o nó", () => {
    expect(deltaFromScore(0.2)).toBe(0);
    expect(deltaFromScore(0.5)).toBe(0.25);
    expect(deltaFromScore(0.9)).toBe(0.5);
    expect(deltaFromScore(0.9) * 2).toBeGreaterThanOrEqual(MASTERY_THRESHOLD);
    expect(sanitizeAssessment({ score: "1.7", note: 1 })).toEqual({ score: 1, note: undefined });
    expect(sanitizeAssessment(null).score).toBe(0);
  });
});
