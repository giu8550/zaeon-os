/**
 * lib/llm/medir.ts — a porta de 1 linha para quem NÃO passa pelo envelope (chat legado, rotas
 * antigas): `void medirVertex(result, ctx, { model, ms })` extrai `usageMetadata` de um
 * GenerateContentResult (ou do `.response` de um StreamGenerateContentResult) e grava no ledger.
 * Best-effort como tudo no ledger: nunca lança.
 */
import { usageDoVertex } from "@/lib/llm/usage";
import { registrarTokens, type LedgerCtx, type LedgerClient } from "@/lib/llm/ledger";

export async function medirVertex(
  result: unknown,
  ctx: LedgerCtx,
  info: { model: string; ms?: number; ok?: boolean; erro?: string | null },
  db?: LedgerClient | null,
): Promise<boolean> {
  try {
    const r: any = result;
    const meta = r?.usageMetadata ?? r?.response?.usageMetadata ?? null;
    return await registrarTokens({
      ...ctx, model: info.model, provedor: "vertex", rota: "vertex", usage: usageDoVertex(meta),
      ms: info.ms ?? 0, ok: info.ok ?? true, erro: (info.erro as any) ?? null, alvo: "vertex", jsonValido: null,
    }, db);
  } catch { return false; }
}
