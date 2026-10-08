/**
 * geminiText — geração de texto simples via Gemini (Vertex AI), tier FLASH.
 *
 * Ponto único para chamadas de texto "leves" do app. Padroniza o Gemini Flash
 * como a ÚNICA IA (substitui usos diretos de Groq/OpenAI). Troca de modelo = env
 * GEMINI_MODEL/GEMINI_MODEL_FLASH (ver lib/ai/model.ts).
 *
 * Desde a Fatia 1 (PR-A1) é um wrapper FINO do envelope (lib/llm/envelope.ts, C5): mesma assinatura,
 * mesmos defaults (temperatura 0.5, timeout 45s, histórico + prompt), e cada chamada grava usage no
 * TokenLedger (best-effort). `ctx` é opcional — default {agentKey:"sistema", surface:"outro"}.
 */
import { GEMINI_MODEL_FLASH } from "./model";
import type { LedgerCtx } from "@/lib/llm/ledger";

export async function geminiText(opts: {
  prompt: string;
  system?: string;
  temperature?: number;
  model?: string;
  /** Histórico da conversa (memória entre turnos). Itens {role:'user'|'model', parts:[{text}]}. */
  history?: { role: string; parts: { text: string }[] }[];
  /** Tempo máximo (ms) antes de desistir — evita pendurar a função até o 504 do Vercel. */
  timeoutMs?: number;
  /** Força saída em JSON puro (responseMimeType). Use em rotas que parseiam JSON. */
  json?: boolean;
  /** Contexto do TokenLedger (C5). */
  ctx?: LedgerCtx;
}): Promise<string> {
  const { gerar } = await import("@/lib/llm/envelope");
  const messages = (opts.history ?? [])
    .map((h) => ({ role: (h.role === "model" ? "model" : "user") as "user" | "model", text: (h.parts ?? []).map((p) => p?.text ?? "").join("") }))
    .filter((m) => m.text);
  const r = await gerar({
    system: opts.system, messages, user: opts.prompt, json: !!opts.json, rota: "vertex",
    model: opts.model || GEMINI_MODEL_FLASH, temperature: opts.temperature ?? 0.5, timeoutMs: opts.timeoutMs ?? 45_000,
    ctx: opts.ctx ?? { agentKey: "sistema", surface: "outro" },
  });
  return r.texto;
}
