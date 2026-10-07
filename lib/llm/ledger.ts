/**
 * lib/llm/ledger.ts — escrita do TokenLedger (contrato C5). PR-G1 entrega o TIPO e um no-op;
 * PR-A1 cria o model Prisma e preenche `registrarTokens` no molde de lib/canal/usage.ts
 * (try/catch, console.warn, boolean, best-effort — NUNCA derruba turno, chat ou busca).
 */
import type { Usage, ClasseErroLlm } from "@/lib/llm/usage";

export type Surface = "estudos" | "pesquisa" | "canal" | "programa" | "aula" | "projetos" | "whatsapp" | "admin" | "chore" | "embedding" | "outro";

export type LedgerCtx = {
  agentKey: string;                       // persona.id | mentor.slug | "sistema"
  surface: Surface;
  userId?: string | null;
  mentorSlug?: string | null;
  scopeId?: string | null;
  programId?: string | null;
  taskId?: string | null;
  phase?: string | null;                  // Phase do harness quando houver
};

export type LinhaLedger = LedgerCtx & {
  model: string;
  provedor: "vertex" | "litellm";
  rota: "vertex" | "gateway";
  usage: Usage;
  ms: number;
  ok: boolean;
  erro?: ClasseErroLlm | null;
  alvo?: string | null;                   // provedor upstream (Fatia 7); "vertex" até lá
  jsonValido?: boolean | null;
};

/** Kill-switch: TOKEN_LEDGER="0" desliga a escrita (o envelope continua igual). */
export const ledgerLigado = (env: Record<string, string | undefined> = process.env): boolean => env.TOKEN_LEDGER !== "0";

/**
 * PR-G1: no-op exportado para o envelope nascer completo e testável. PR-A1 troca o corpo por
 * `prisma.tokenLedger.create` best-effort. Assinatura fixa: devolve se gravou.
 */
export async function registrarTokens(_linha: LinhaLedger): Promise<boolean> {
  return false;
}
