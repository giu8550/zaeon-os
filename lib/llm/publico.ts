/**
 * lib/llm/publico.ts — texto gerado a partir de conteúdo 100% PÚBLICO vai pelo POOL GRÁTIS (lib/llm/pool).
 *
 * Só entra aqui o que não tem nada do aluno: metadados de artigo (título, autores, abstract) e afins. A pergunta,
 * o texto ou os documentos do aluno NUNCA (os planos grátis podem treinar com o que recebem — §8.10).
 * Usado por: resumo leve de artigo (/api/ai/summarize-lite) e "cruzar" dois artigos pelos metadados (/api/ai/relate).
 *
 * Caminho: gateway `zaeon-pool-lite` (AI Studio grátis) → `zaeon-pool-cerebras` (grátis) → `zaeon-reserva-google`
 * (Vertex flash-lite pago) — a cadeia mora no infra/litellm.config.yaml. Gateway fora / sem key / pool esgotado
 * de vez → o Vertex flash direto, pra o aluno nunca ficar sem o resumo. POOL_PUBLICO=0 desliga (vai direto no Vertex).
 */
import { gerar, type Deps } from "@/lib/llm/envelope";
import { MODELO_POOL } from "@/lib/llm/pool";
import { chaveDoAgente, gatewayLigado } from "@/lib/llm/usage";
import { GEMINI_MODEL_FLASH } from "@/lib/ai/model";
import type { Surface } from "@/lib/llm/ledger";

type Env = Record<string, string | undefined>;

/** A key do agente "aura" é a que tem o pool na allowlist (scripts/gateway-keys.mjs --pool aura). */
export const AGENTE_POOL = "aura";

export function poolPublicoLigado(env: Env = process.env): boolean {
  if (/^(0|off|false)$/i.test(env.POOL_PUBLICO?.trim() ?? "")) return false;
  return gatewayLigado(env) && Boolean(chaveDoAgente(AGENTE_POOL, env));
}

export async function gerarTextoPublico(
  o: { system: string; prompt: string; temperature?: number; surface: Surface; phase: string; userId?: string | null },
  deps: Deps = {},
): Promise<{ texto: string; alvo?: string }> {
  const env = deps.env ?? process.env;
  const ctx = { agentKey: AGENTE_POOL, surface: o.surface, phase: o.phase, userId: o.userId ?? null };
  const base = { system: o.system, user: o.prompt, temperature: o.temperature ?? 0.5, ctx };
  if (poolPublicoLigado(env)) {
    try {
      const r = await gerar({ ...base, model: MODELO_POOL, rota: "gateway", timeoutMs: 45_000 }, deps);
      if (r.texto.trim()) return { texto: r.texto, alvo: r.alvo };
    } catch (e: any) {
      console.warn(`[pool-publico] ${o.phase}: pool indisponível — Vertex direto (${String(e?.message ?? e).slice(0, 120)})`);
    }
  }
  const r = await gerar({ ...base, model: GEMINI_MODEL_FLASH, rota: "vertex" }, deps);
  return { texto: r.texto, alvo: r.alvo };
}
