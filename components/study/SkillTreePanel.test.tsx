// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { enquadrar, layoutByLevel } from "./SkillTreePanel";

const no = (id: string, level: number, prereqs: string[] = []) => ({ id, title: id, branch: "teoria" as const, level, prereqs, status: "available" as const, mastery: 0, summary: "" });

describe("enquadrar — a árvore cabe e fica no meio, sem depender da medição do React Flow", () => {
  const { nodes } = layoutByLevel([no("a", 1), no("b", 2, ["a"]), no("c", 2, ["a"]), no("d", 2, ["a"]), no("e", 3, ["b"])], null);
  const caixa = (w: number, h: number) => {
    const v = enquadrar(nodes, w, h);
    const xs = nodes.map((n) => n.position.x * v.zoom + v.x);
    return { esq: Math.min(...xs), dir: Math.max(...xs) + 170 * v.zoom, v };
  };
  it("gaveta (460px): todos os nós dentro da largura, centralizados", () => {
    const { esq, dir } = caixa(460, 700);
    expect(esq).toBeGreaterThanOrEqual(0);
    expect(dir).toBeLessThanOrEqual(460);
    expect(Math.abs((esq + dir) / 2 - 230)).toBeLessThan(2);
  });
  it("expandida: a escala cresce (até 1.2) e continua centrada", () => {
    const g = caixa(460, 700).v.zoom, e = caixa(1100, 800);
    expect(e.v.zoom).toBeGreaterThan(g);
    expect(e.v.zoom).toBeLessThanOrEqual(1.2);
    expect(Math.abs((e.esq + e.dir) / 2 - 550)).toBeLessThan(2);
  });
  it("sem largura ainda / sem nós: não quebra", () => {
    expect(enquadrar([], 400, 300)).toEqual({ x: 115, y: 24, zoom: 1 });
    expect(enquadrar(nodes, 0, 0).zoom).toBe(1);
  });
});
