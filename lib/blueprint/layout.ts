/**
 * BLUEPRINT PRÁTICO — o LAYOUT da prancha (PURO). Pedido do dono: "simetria e não caos", tudo "direcionado da esquerda
 * para a direita". O conhecimento (o percurso) fica à ESQUERDA e alimenta o ESTUDO no centro, que desemboca na PRÁTICA
 * à DIREITA (repositórios, conversas, demo, produto, próximos). No eixo central, de cima pra baixo: a figura, o estudo,
 * a avaliação da Zaeon e a faixa dos críticos (de 2 em 2, espelhados). Os dois lados ficam centrados no meio do estudo.
 * O que a pessoa arrastou (`fixos`) fica onde ela soltou; o resto é sempre recalculado — a Zaeon pode reorganizar à
 * vontade sem virar bagunça. As alturas vêm medidas do DOM (`alturaDe`).
 */
import type { DocBlueprint } from "./tipos";

export type IdModulo = string;
export type Lado = "esq" | "centro" | "dir";
export type Caixa = { id: IdModulo; x: number; y: number; w: number; h: number; lado: Lado };
export type Fio = { de: IdModulo; para: IdModulo; tipo: "percurso" | "pratica" | "critico" | "figura" | "avaliacao" };
export const LARG = { centro: 440, lado: 330, critico: 300 } as const;
const VAO_LADO = 200, GAP = 34, GAP_CENTRO = 40;

/** os módulos que aparecem na prancha, na ordem (a demo aparece sempre — travada até existir) */
export function modulosDo(doc: DocBlueprint): { id: IdModulo; lado: Lado }[] {
  const abertos = doc.criticos.filter((c) => c.status === "aberto" && c.fase === doc.fase);
  const centro: IdModulo[] = [
    ...(doc.pecas.length ? ["figura"] : []), "estudo",
    ...(doc.avaliacoes.length && !abertos.length ? ["avaliacao"] : []),
    ...abertos.map((c) => `critico:${c.id}`),
  ];
  const dir: IdModulo[] = [
    ...(doc.repos.length ? ["repos"] : []), ...(doc.participantes.length ? ["conversas"] : []), "demo",
    ...(doc.produto ? ["produto"] : []), ...(doc.proximos.length ? ["proximos"] : []),
    ...doc.notas.map((n) => `nota:${n.id}`),
  ];
  return [
    ...doc.passos.map((p) => ({ id: `passo:${p.id}`, lado: "esq" as const })),
    ...centro.map((id) => ({ id, lado: "centro" as const })),
    ...dir.map((id) => ({ id, lado: "dir" as const })),
  ];
}

export function layoutBlueprint(doc: DocBlueprint, alturaDe: (id: IdModulo) => number): { caixas: Caixa[]; fios: Fio[] } {
  const mods = modulosDo(doc), caixas: Caixa[] = [];
  const h = (id: IdModulo) => Math.max(40, alturaDe(id) || 0);
  // ── o eixo central ──
  let y = 0;
  const xC = -LARG.centro / 2;
  for (const id of ["figura", "estudo", "avaliacao"]) {
    if (!mods.some((m) => m.id === id)) continue;
    caixas.push({ id, x: xC, y, w: LARG.centro, h: h(id), lado: "centro" }); y += h(id) + GAP_CENTRO;
  }
  const criticos = mods.filter((m) => m.id.startsWith("critico:"));
  for (let i = 0; i < criticos.length; i += 2) {
    const par = criticos.slice(i, i + 2), alto = Math.max(...par.map((m) => h(m.id)));
    par.forEach((m, k) => {
      const x = par.length === 1 ? -LARG.critico / 2 : k === 0 ? -LARG.critico - GAP_CENTRO / 2 : GAP_CENTRO / 2;
      caixas.push({ id: m.id, x, y, w: LARG.critico, h: h(m.id), lado: "centro" });
    });
    y += alto + GAP_CENTRO;
  }
  const estudo = caixas.find((c) => c.id === "estudo")!, meio = estudo.y + estudo.h / 2;
  // ── os dois lados, centrados no meio do estudo ──
  const pilha = (lado: "esq" | "dir", x: number) => {
    const ms = mods.filter((m) => m.lado === lado); if (!ms.length) return;
    const total = ms.reduce((s, m) => s + h(m.id), 0) + GAP * (ms.length - 1);
    let yy = meio - total / 2;
    for (const m of ms) { caixas.push({ id: m.id, x, y: yy, w: LARG.lado, h: h(m.id), lado }); yy += h(m.id) + GAP; }
  };
  pilha("esq", xC - VAO_LADO - LARG.lado);
  pilha("dir", -xC + VAO_LADO);
  // ── o que foi arrastado ──
  for (const c of caixas) { const f = doc.fixos[c.id]; if (f) { c.x = f.x; c.y = f.y; } }
  // ── os fios ──
  const tem = new Set(caixas.map((c) => c.id)), fios: Fio[] = [];
  if (tem.has("figura")) fios.push({ de: "figura", para: "estudo", tipo: "figura" });
  if (tem.has("avaliacao")) fios.push({ de: "estudo", para: "avaliacao", tipo: "avaliacao" });
  for (const c of caixas) {
    if (c.lado === "esq") fios.push({ de: "estudo", para: c.id, tipo: "percurso" });
    else if (c.lado === "dir") fios.push({ de: "estudo", para: c.id, tipo: "pratica" });
  }
  for (const c of doc.criticos) {
    const id = `critico:${c.id}`; if (!tem.has(id)) continue;
    fios.push({ de: "estudo", para: id, tipo: "critico" });
    if (c.passoId && tem.has(`passo:${c.passoId}`)) fios.push({ de: id, para: `passo:${c.passoId}`, tipo: "critico" });
  }
  return { caixas, fios };
}
