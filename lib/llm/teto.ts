/**
 * lib/llm/teto.ts — teto diário de tokens por agente (PR-A3). LER ≠ AGIR:
 *   - o admin SEMPRE mostra "estouraria o teto hoje (usado/teto)" quando `fora` (leitura);
 *   - só `AGENT_TETO_ENFORCE=1` + turno `origem:"autonomo"` barra de verdade (lib/canal/agent-turn.ts).
 * "Hoje" = dia LOCAL do servidor (TZ do processo), virando à meia-noite.
 */
export type TetoClient = {
  agentProfile: { findUnique(args: { where: { agentKey: string }; select: { tetoTokensDia: true } }): Promise<{ tetoTokensDia: number | null } | null> };
  tokenLedger: { aggregate(args: { where: { agentKey: string; at: { gte: Date } }; _sum: { totalTokens: true } }): Promise<{ _sum: { totalTokens: number | null } }> };
};
export type EstadoTeto = { fora: boolean; usado: number; teto: number | null };

/** Meia-noite LOCAL do dia de `agora`. */
export function inicioDoDiaLocal(agora: Date = new Date()): Date {
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
}

/** PURO: decide a partir dos números. teto null/0 = sem teto (0 seria "nunca pode falar" — tratamos como sem teto). */
export function decidirTeto(usado: number, teto: number | null | undefined): EstadoTeto {
  const t = typeof teto === "number" && teto > 0 ? teto : null;
  return { fora: t !== null && usado >= t, usado, teto: t };
}

export async function foraPorTeto(db: TetoClient, agentKey: string, agora: Date = new Date()): Promise<EstadoTeto> {
  const perfil = await db.agentProfile.findUnique({ where: { agentKey }, select: { tetoTokensDia: true } });
  const teto = perfil?.tetoTokensDia ?? null;
  if (!teto) return { fora: false, usado: 0, teto: null }; // sem teto: não gasta uma query no ledger
  const agg = await db.tokenLedger.aggregate({ where: { agentKey, at: { gte: inicioDoDiaLocal(agora) } }, _sum: { totalTokens: true } });
  return decidirTeto(agg._sum.totalTokens ?? 0, teto);
}

/** Enforce ligado? (server-only) */
export const tetoEnforce = (env: Record<string, string | undefined> = process.env): boolean => env.AGENT_TETO_ENFORCE === "1";
