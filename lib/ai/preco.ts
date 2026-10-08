/**
 * lib/ai/preco.ts — tabela de preço por modelo (USD por milhão de tokens).
 *
 * ESTIMATIVA — editar aqui; não é fatura. Fonte única do `estimatedCostUsd` do TokenLedger (C5).
 * `cached` é cobrado pelo preço de cache (≈10% do prompt no Vertex) — somar cache como token cheio
 * inflaria o custo justamente quando o contextCache está funcionando.
 * Modelos do pool grátis (Fatia 7) entram com 0 e comentário "free tier".
 */
import type { Usage } from "@/lib/llm/usage";

export type Preco = { prompt: number; completion: number; cached: number };

export const USD_POR_MILHAO: Record<string, Preco> = {
  // Gemini 2.5 (Vertex, ≤200k de contexto) — conferido 2026-10; editar quando o Google mexer.
  "gemini-2.5-flash":      { prompt: 0.30, completion: 2.50, cached: 0.03 },
  "gemini-2.5-flash-lite": { prompt: 0.10, completion: 0.40, cached: 0.01 },
  "gemini-2.5-pro":        { prompt: 1.25, completion: 10.00, cached: 0.125 },
  // Gemini 3.x (quando o projeto habilitar) — valores provisórios = 2.5 equivalentes.
  "gemini-3.5-flash":      { prompt: 0.30, completion: 2.50, cached: 0.03 },
  "gemini-3.1-pro":        { prompt: 1.25, completion: 10.00, cached: 0.125 },
};

/** Modelo desconhecido → preço do flash (conservador) e marca para o admin saber. */
export const PRECO_DESCONHECIDO: Preco = USD_POR_MILHAO["gemini-2.5-flash"];

export function precoDe(model: string): { preco: Preco; conhecido: boolean } {
  const k = Object.keys(USD_POR_MILHAO).find((m) => model === m || model.startsWith(m + "-") || model.endsWith("/" + m));
  return k ? { preco: USD_POR_MILHAO[k], conhecido: true } : { preco: PRECO_DESCONHECIDO, conhecido: false };
}

/** PURO. prompt, completion e cached cada um pelo seu preço. */
export function custoEstimadoUsd(model: string, u: Pick<Usage, "promptTokens" | "completionTokens" | "cachedTokens">): number {
  const { preco } = precoDe(model);
  const usd = (u.promptTokens * preco.prompt + u.completionTokens * preco.completion + u.cachedTokens * preco.cached) / 1_000_000;
  return Math.round(usd * 1e8) / 1e8;
}
