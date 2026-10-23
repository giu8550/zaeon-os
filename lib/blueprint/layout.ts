/**
 * BLUEPRINT PRÁTICO — o LAYOUT da prancha (PURO). Pedidos do dono: "simetria e não caos", tudo "direcionado da esquerda
 * para a direita" — e depois (22/10): "os quadros estão muito pequenos e temos que movimentar muito a câmera; deixa
 * eles maiores e não panorâmicos, assim vamos vendo outros conforme vamos progredindo".
 *
 * Então a prancha mostra o FOCO da fase atual, com cards grandes:
 *  - à ESQUERDA, o percurso até a fase atual; os passos das fases seguintes ficam RECOLHIDOS num card só ("próximas
 *    fases") e vão aparecendo quando a fase avança;
 *  - no CENTRO, de cima pra baixo: a FIGURA do tema (a protagonista, larga, fora de card — a máquina de lib/blueprint/maquina), o
 *    ESTUDO, a avaliação da Zaeon e os críticos da fase (um embaixo do outro);
 *  - à DIREITA, a prática: estudar no YouTube, repositórios, conversas, produto, próximos — e a demo só a partir da
 *    fase em que ela é construída (3).
 * Os dois lados ficam centrados no meio do estudo; a figura tem exatamente a largura do centro + os vãos, então nunca
 * encosta nos lados. O que a pessoa arrastou (`fixos`) fica onde ela soltou. Alturas medidas do DOM (`alturaDe`).
 */
import type { DocBlueprint } from "./tipos";

export type IdModulo = string;
export type Lado = "esq" | "centro" | "dir";
export type Caixa = { id: IdModulo; x: number; y: number; w: number; h: number; lado: Lado };
export type Fio = { de: IdModulo; para: IdModulo; tipo: "percurso" | "pratica" | "critico" | "figura" | "avaliacao" };
const VAO_LADO = 120, GAP = 28, GAP_CENTRO = 36;
export const LARG = { centro: 520, lado: 400, critico: 520, figura: 520 + 2 * VAO_LADO } as const;
/** a fase em que a demo é construída (antes disso ela não aparece — "vamos vendo conforme progredimos") */
export const FASE_DA_DEMO = 3;

/** os módulos que aparecem na prancha, na ordem — só o FOCO da fase atual */
export function modulosDo(doc: DocBlueprint): { id: IdModulo; lado: Lado }[] {
  const abertos = doc.criticos.filter((c) => c.status === "aberto" && c.fase === doc.fase);
  const centro: IdModulo[] = [
    ...(doc.pecas.length ? ["figura"] : []), "estudo",
    ...(doc.avaliacoes.length && !abertos.length ? ["avaliacao"] : []),
    ...abertos.map((c) => `critico:${c.id}`),
  ];
  const ate = doc.passos.filter((p) => p.fase <= doc.fase), depois = doc.passos.filter((p) => p.fase > doc.fase);
  const esq: IdModulo[] = [...ate.map((p) => `passo:${p.id}`), ...(depois.length ? ["futuro"] : [])];
  const dir: IdModulo[] = [
    "youtube",
    ...(doc.repos.length ? ["repos"] : []), ...(doc.participantes.length ? ["conversas"] : []),
    ...(doc.fase >= FASE_DA_DEMO || doc.demo?.url ? ["demo"] : []),
    ...(doc.produto ? ["produto"] : []), ...(doc.proximos.length ? ["proximos"] : []),
    ...doc.notas.map((n) => `nota:${n.id}`),
  ];
  return [
    ...esq.map((id) => ({ id, lado: "esq" as const })),
    ...centro.map((id) => ({ id, lado: "centro" as const })),
    ...dir.map((id) => ({ id, lado: "dir" as const })),
  ];
}

export function layoutBlueprint(doc: DocBlueprint, alturaDe: (id: IdModulo) => number): { caixas: Caixa[]; fios: Fio[] } {
  const mods = modulosDo(doc), caixas: Caixa[] = [];
  const h = (id: IdModulo) => Math.max(40, alturaDe(id) || 0);
  // ── o eixo central (um embaixo do outro) ──
  let y = 0;
  for (const m of mods.filter((k) => k.lado === "centro")) {
    const w = m.id === "figura" ? LARG.figura : m.id.startsWith("critico:") ? LARG.critico : LARG.centro;
    caixas.push({ id: m.id, x: -w / 2, y, w, h: h(m.id), lado: "centro" }); y += h(m.id) + GAP_CENTRO;
  }
  const estudo = caixas.find((c) => c.id === "estudo")!, meio = estudo.y + estudo.h / 2;
  // ── os dois lados, centrados no meio do estudo ──
  const pilha = (lado: "esq" | "dir", x: number) => {
    const ms = mods.filter((m) => m.lado === lado); if (!ms.length) return;
    const total = ms.reduce((s, m) => s + h(m.id), 0) + GAP * (ms.length - 1);
    let yy = meio - total / 2;
    for (const m of ms) { caixas.push({ id: m.id, x, y: yy, w: LARG.lado, h: h(m.id), lado }); yy += h(m.id) + GAP; }
  };
  pilha("esq", -LARG.centro / 2 - VAO_LADO - LARG.lado);
  pilha("dir", LARG.centro / 2 + VAO_LADO);
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

/** o enquadramento inicial: o FOCO (figura + estudo + críticos), não a prancha inteira — os lados se veem andando */
export function caixaDoFoco(caixas: readonly Caixa[]): { x0: number; y0: number; x1: number; y1: number } | null {
  const foco = caixas.filter((c) => c.lado === "centro");
  if (!foco.length) return null;
  return { x0: Math.min(...foco.map((c) => c.x)), y0: Math.min(...foco.map((c) => c.y)), x1: Math.max(...foco.map((c) => c.x + c.w)), y1: Math.max(...foco.map((c) => c.y + c.h)) };
}
