/**
 * lib/canal/usage.ts — registro de USO de agente (quem usa qual agente), pro card founder.
 * Incremento idempotente por (agentKey,userId) via upsert; best-effort — nunca derruba
 * um turno de chat por causa de métrica. Agregação PURA pro admin.
 */
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export type UsageClient = {
  agentUsage: {
    upsert(args: {
      where: { agentKey_userId: { agentKey: string; userId: string } };
      update: { contagem: { increment: number }; ultimoUso: Date };
      create: { agentKey: string; userId: string; contagem: number; ultimoUso: Date };
    }): Promise<unknown>;
  };
};

/** +1 uso de `agentKey` por `userId`. Ignora ids inválidos; engole erro de banco. */
export async function registrarUso(prisma: UsageClient, agentKey: string, userId: string | null | undefined): Promise<boolean> {
  if (!agentKey || !userId || !OBJECT_ID_RE.test(userId)) return false;
  try {
    const now = new Date();
    await prisma.agentUsage.upsert({
      where: { agentKey_userId: { agentKey, userId } },
      update: { contagem: { increment: 1 }, ultimoUso: now },
      create: { agentKey, userId, contagem: 1, ultimoUso: now },
    });
    return true;
  } catch (e) {
    console.warn("[agent-usage] registrarUso falhou:", (e as Error)?.message);
    return false;
  }
}

export type UsageRow = { agentKey: string; userId: string; contagem: number; ultimoUso: Date | string };
export type UsageAgg = {
  total: number;                 // soma das contagens
  usuarios: number;              // quantos usuários distintos
  ultimoUso: string | null;      // ISO do uso mais recente
  top: { userId: string; contagem: number; ultimoUso: string }[]; // top N por contagem
};

/** Agrega as linhas por agentKey (total, nº de usuários, top N usuários). */
export function agregarUso(rows: UsageRow[], topN = 5): Record<string, UsageAgg> {
  const out: Record<string, UsageAgg> = {};
  for (const r of rows) {
    const a = (out[r.agentKey] ??= { total: 0, usuarios: 0, ultimoUso: null, top: [] });
    const iso = new Date(r.ultimoUso).toISOString();
    a.total += r.contagem;
    a.usuarios += 1;
    if (!a.ultimoUso || iso > a.ultimoUso) a.ultimoUso = iso;
    a.top.push({ userId: r.userId, contagem: r.contagem, ultimoUso: iso });
  }
  for (const a of Object.values(out)) {
    a.top.sort((x, y) => y.contagem - x.contagem || y.ultimoUso.localeCompare(x.ultimoUso));
    a.top = a.top.slice(0, topN);
  }
  return out;
}
