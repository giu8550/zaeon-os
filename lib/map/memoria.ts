/**
 * lib/map/memoria.ts — a MEMÓRIA do cérebro, PURA (handoff §4.2): o que o estado da arte
 * ensina, aplicado sobre o grafo que já é a fonte única.
 *
 *  - consolidar (A-MEM / Zettelkasten): arestas ASSOCIATIVAS entre nós que falam da mesma coisa
 *    (sobreposição lexical dos labels/closets) — sem LLM, roda a cada turno sobre o que mudou.
 *  - atribuirRegioes: cada nó pertence à região do nó do PERCURSO mais próximo (BFS); o que não
 *    alcança o percurso vira uma "nova área" (a modularidade: novos objetivos abrem regiões).
 *  - recuperarMemoria (HippoRAG + Generative Agents): PageRank personalizado semeado pela
 *    consulta × recência × importância → os nós (gavetas/closets) que entram na bússola.
 */
import type { MapaAresta, MapaNo } from "@/lib/map/tipos";

const STOP = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "um", "uma", "que", "com", "por", "para", "pra", "se", "ao", "aos", "the", "of", "and", "in", "to", "is", "sobre", "como", "entre", "mais", "seu", "sua", "este", "esta", "isso", "the", "evidencia", "evidência", "proximo", "próximo", "passo"]);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Tokens significativos (≥3 letras, sem stopwords). */
export function tokens(s: string): Set<string> {
  return new Set(norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t)));
}
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export const LIMIAR_ASSOCIACAO = 0.34;
export const MAX_ASSOCIACOES_POR_TURNO = 24;

/**
 * Arestas associativas (tipoVisual "memoria", relacao "relacionado") entre `foco` (nós que mudaram
 * neste turno) e os demais, por sobreposição lexical de label+closet. Só adiciona o que não existe.
 */
export function consolidar(nos: MapaNo[], arestas: MapaAresta[], foco: string[]): MapaAresta[] {
  const focoSet = new Set(foco);
  const tok = new Map(nos.map((n) => [n.id, tokens(`${n.label} ${n.closet ?? n.corpo ?? ""}`)]));
  const existentes = new Set(arestas.flatMap((a) => [`${a.de}>${a.para}`, `${a.para}>${a.de}`]));
  const novas: MapaAresta[] = [];
  const cand: { de: string; para: string; peso: number }[] = [];
  for (const f of nos) {
    if (!focoSet.has(f.id)) continue;
    for (const n of nos) {
      if (n.id === f.id || (focoSet.has(n.id) && n.id < f.id)) continue; // par foco×foco só uma vez
      if (existentes.has(`${f.id}>${n.id}`)) continue;
      const j = jaccard(tok.get(f.id)!, tok.get(n.id)!);
      if (j >= LIMIAR_ASSOCIACAO) cand.push({ de: f.id, para: n.id, peso: Math.round(j * 100) / 100 });
    }
  }
  cand.sort((a, b) => b.peso - a.peso);
  for (const c of cand.slice(0, MAX_ASSOCIACOES_POR_TURNO)) {
    existentes.add(`${c.de}>${c.para}`);
    novas.push({ de: c.de, para: c.para, relacao: "relacionado", tipoVisual: "memoria", peso: c.peso });
  }
  return novas;
}

export const REGIAO_NOVA = "nova-area";

/** Região = nó do percurso mais próximo (BFS não-direcionada). Sem alcance → "nova-area" (abre região). */
export function atribuirRegioes(nos: MapaNo[], arestas: MapaAresta[], backbone: string[]): MapaNo[] {
  if (!backbone.length) return nos;
  const viz = new Map<string, string[]>();
  for (const a of arestas) { (viz.get(a.de) ?? viz.set(a.de, []).get(a.de)!).push(a.para); (viz.get(a.para) ?? viz.set(a.para, []).get(a.para)!).push(a.de); }
  const regiao = new Map<string, string>();
  const fila: string[] = [];
  for (const b of backbone) { if (nos.some((n) => n.id === b)) { regiao.set(b, b); fila.push(b); } }
  while (fila.length) { const cur = fila.shift()!; for (const v of viz.get(cur) ?? []) { if (!regiao.has(v)) { regiao.set(v, regiao.get(cur)!); fila.push(v); } } }
  return nos.map((n) => { const r = regiao.get(n.id) ?? REGIAO_NOVA; return n.regiao === r ? n : { ...n, regiao: r }; });
}

export type Lembranca = { no: MapaNo; score: number; porque: string[] };

/** Recência: meia-vida de 7 dias (Generative Agents). 1 = agora; sem tLast = 0.3. */
export function recencia(tLast: number | undefined, agora: number): number {
  if (!tLast) return 0.3;
  const dias = Math.max(0, agora - tLast) / 86_400_000;
  return Math.pow(0.5, dias / 7);
}

/**
 * Recuperação: PPR semeado pela sobreposição lexical da consulta (multi-hop pelo grafo),
 * ponderado por recência e importância (peso do nó). Só nós com memória (gavetas) ou que
 * batem na consulta entram. Determinístico, sem embeddings (semântica entra depois, se vier).
 */
export function recuperarMemoria(nos: MapaNo[], arestas: MapaAresta[], consulta: string, opts: { k?: number; agora?: number; alpha?: number; iteracoes?: number } = {}): Lembranca[] {
  const k = opts.k ?? 4, agora = opts.agora ?? Date.now(), alpha = opts.alpha ?? 0.85, iter = opts.iteracoes ?? 20;
  if (!nos.length) return [];
  const idx = new Map(nos.map((n, i) => [n.id, i]));
  const q = tokens(consulta);
  const seed = nos.map((n) => jaccard(q, tokens(`${n.label} ${n.closet ?? n.corpo ?? ""}`)));
  const totalSeed = seed.reduce((a, b) => a + b, 0);
  const personal = totalSeed > 0 ? seed.map((s) => s / totalSeed) : nos.map(() => 1 / nos.length);
  // vizinhança ponderada (não-direcionada)
  const viz: { j: number; w: number }[][] = nos.map(() => []);
  for (const a of arestas) {
    const i = idx.get(a.de), j = idx.get(a.para); if (i === undefined || j === undefined) continue;
    const w = a.peso ?? 0.5; viz[i]!.push({ j, w }); viz[j]!.push({ j: i, w });
  }
  const grau = viz.map((v) => v.reduce((s, e) => s + e.w, 0));
  let pr = personal.slice();
  for (let t = 0; t < iter; t++) {
    const next = personal.map((p) => (1 - alpha) * p);
    for (let i = 0; i < nos.length; i++) {
      if (!grau[i]) { for (let j = 0; j < nos.length; j++) next[j]! += alpha * pr[i]! * personal[j]!; continue; } // nó sem vizinhos: devolve a massa pela personalização
      for (const e of viz[i]!) next[e.j]! += alpha * pr[i]! * (e.w / grau[i]!);
    }
    pr = next;
  }
  const out: Lembranca[] = nos.map((n, i) => {
    const temMemoria = (n.drawers?.length ?? 0) > 0, bate = seed[i]! > 0;
    if (!temMemoria && !bate) return { no: n, score: 0, porque: [] };
    const r = recencia(n.tLast, agora), imp = 0.5 + 0.5 * n.peso;
    const score = (pr[i]! + 0.02 * (bate ? 1 : 0) + 0.005 * (temMemoria ? 1 : 0)) * (0.5 + 0.5 * r) * imp;
    const porque = [...(bate ? ["bate na pergunta"] : []), ...(pr[i]! > (personal[i] ?? 0) * 1.05 ? ["ligado ao assunto"] : []), ...(r > 0.7 ? ["recente"] : [])];
    return { no: n, score, porque };
  }).filter((l) => l.score > 0).sort((a, b) => b.score - a.score);
  return out.slice(0, k);
}

/** Texto das lembranças pro prompt (closet + a gaveta mais recente, curtos). */
export function textoDeLembrancas(ls: Lembranca[], maxChars = 900): string {
  if (!ls.length) return "";
  const partes = ls.map((l) => {
    const g = l.no.drawers?.at(-1)?.texto.replace(/\s+/g, " ").slice(0, 180);
    return `• ${l.no.label}${l.no.closet && l.no.closet !== l.no.label ? ` — ${l.no.closet.slice(0, 100)}` : ""}${g ? ` | gaveta: "${g}${g.length >= 180 ? "…" : ""}"` : ""}`;
  });
  const txt = "Memória relevante (gavetas do cérebro):\n" + partes.join("\n");
  return txt.length > maxChars ? txt.slice(0, maxChars - 1) + "…" : txt;
}
