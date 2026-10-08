/**
 * lib/chore/catalogo.ts — os 9 tipos → sequência FIXA de tools (C8). Não é o modelo que escolhe a tool.
 * `origem` decide a rota (rotaDaChore): web = pool grátis; anexo|canal = Vertex (§8.10).
 * `llmMax` ≤ 3 (freio §3.8). extrair_campos é web|anexo: a origem real vem da linha (alvo.url → web).
 */
import type { ChoreToolName } from "@/lib/chore/tools";
import type { OrigemConteudo, TipoChore } from "@/lib/chore/store";

export type PassoCatalogo = { ler: ChoreToolName[]; agir: ChoreToolName[]; origem: OrigemConteudo | "web|anexo"; llmMax: number; comCursor: boolean };

export const CATALOGO: Record<TipoChore, PassoCatalogo> = {
  checar_pagina:     { ler: ["fetch_url", "diff_check", "summarize_short"], agir: ["post_internal"], origem: "web",       llmMax: 1, comCursor: true },
  feed_novos:        { ler: ["fetch_url", "diff_check", "extract"],         agir: ["post_internal"], origem: "web",       llmMax: 1, comCursor: true },
  resumir_link:      { ler: ["fetch_url", "summarize_short"],               agir: ["post_internal"], origem: "web",       llmMax: 1, comCursor: false },
  classificar_anexo: { ler: ["classify"],                                   agir: ["post_internal"], origem: "anexo",     llmMax: 1, comCursor: false },
  extrair_campos:    { ler: ["fetch_url", "extract", "format"],             agir: ["post_internal"], origem: "web|anexo", llmMax: 1, comCursor: false },
  digest:            { ler: ["diff_check", "summarize_short"],              agir: ["post_internal"], origem: "canal",     llmMax: 2, comCursor: true },
  link_rot:          { ler: ["fetch_url", "format"],                        agir: ["post_internal"], origem: "web",       llmMax: 0, comCursor: false },
  formatar_abnt:     { ler: ["format"],                                     agir: ["post_internal"], origem: "canal",     llmMax: 0, comCursor: false },
  traduzir_trecho:   { ler: ["translate_short"],                            agir: ["post_internal"], origem: "canal",     llmMax: 1, comCursor: false },
};

/** A origem efetiva: extrair_campos com URL é web; sem URL (texto de anexo) é anexo. */
export function origemDe(tipo: TipoChore, alvo: { url?: string }): OrigemConteudo {
  const o = CATALOGO[tipo].origem;
  if (o === "web|anexo") return alvo.url ? "web" : "anexo";
  return o;
}
