/**
 * lib/chipflow/canal.ts — qual chip um agente usa pra mandar WhatsApp, e o registro do envio.
 *
 * Ordem: AgentChannel (tipo whatsapp, estado vinculado, com chipflowId) → BRIDGE_INSTANCE_ID da
 * env → null (= provider não configurado). Prisma entra por import dinâmico: o sender puro e
 * os testes não carregam o client. Falha de banco nunca derruba o envio (cai na env / engole).
 */
import { localParts } from "@/lib/whatsapp/policy";
import type { Env } from "./bridge-request";

export type DestinoEnvio =
  | { fonte: "canal"; canalId: string; chipflowId: number }
  | { fonte: "env"; chipflowId: number };

/** BRIDGE_INSTANCE_ID como inteiro positivo; qualquer outra coisa é "ausente". */
export function instanceIdDaEnv(env: Env): number | null {
  const raw = (env.BRIDGE_INSTANCE_ID ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function db() {
  const { prisma } = await import("@/src/lib/prisma");
  return prisma;
}

export async function resolverCanalEnvio(agentKey: string, env: Env = process.env): Promise<DestinoEnvio | null> {
  try {
    const prisma = await db();
    const canal = await prisma.agentChannel.findUnique({ where: { agentKey_tipo: { agentKey, tipo: "whatsapp" } } });
    if (canal?.estado === "vinculado" && typeof canal.chipflowId === "number" && canal.chipflowId > 0) {
      return { fonte: "canal", canalId: canal.id, chipflowId: canal.chipflowId };
    }
  } catch (e) {
    console.warn("[chipflow:canal] leitura falhou, usando env:", (e as Error)?.message ?? e);
  }
  const envId = instanceIdDaEnv(env);
  return envId ? { fonte: "env", chipflowId: envId } : null;
}

/** Contagem do dia (BRT) + último envio/erro no canal. Best-effort: nunca lança. */
export async function registrarEnvio(canalId: string, r: { ok: boolean; error?: string }, now: Date = new Date()): Promise<void> {
  try {
    const prisma = await db();
    if (!r.ok) {
      await prisma.agentChannel.update({ where: { id: canalId }, data: { ultimoErro: (r.error ?? "falha").slice(0, 300) } });
      return;
    }
    const hoje = localParts(now).dateKey;
    // Incremento ATÔMICO condicionado ao dia: dois envios simultâneos não se perdem (o PR-W3
    // vai confiar nesse número pro teto do chip). Só na virada do dia cai no reset.
    const { count } = await prisma.agentChannel.updateMany({
      where: { id: canalId, diaContagem: hoje },
      data: { enviadosHoje: { increment: 1 }, ultimoEnvioEm: now, ultimoErro: null },
    });
    if (!count) {
      await prisma.agentChannel.update({
        where: { id: canalId },
        data: { enviadosHoje: 1, diaContagem: hoje, ultimoEnvioEm: now, ultimoErro: null },
      });
    }
  } catch (e) {
    console.warn("[chipflow:canal] registro falhou:", (e as Error)?.message ?? e);
  }
}
