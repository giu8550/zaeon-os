/**
 * lib/avatars/banco.ts — avatares vivos gerados no ADMIN (Etapa B), no Mongo (server-only).
 *
 * Os quadros são servidos por GET /api/agents/avatars/<agentKey>/<estado>(.sm).webp?v=<versao>
 * (imutável: versão nova = URL nova). Os manifestos são montados só com metadados (sem bytes).
 */
import { prisma } from "@/src/lib/prisma";
import { normalizarManifest, type AvatarManifest, type EstadoSprite } from "./estados";
import type { SetParaSalvar } from "./estudio";

export const urlQuadroBanco = (agentKey: string, arquivo: string, versao: string) =>
  `/api/agents/avatars/${encodeURIComponent(agentKey)}/${arquivo}?v=${versao}`;

/** Manifestos de todos os agentes com set salvo no banco. */
export async function manifestosDoBanco(): Promise<Record<string, AvatarManifest>> {
  const linhas = await prisma.agentAvatarQuadro.findMany({
    where: { tamanho: { in: ["g", "p"] } },
    select: { agentKey: true, estado: true, tamanho: true, versao: true, cor: true },
  });
  const brutos: Record<string, { agentId: string; versao: string; cor?: string; motor: "sprite"; estados: Record<string, string>; pequeno: Record<string, string> }> = {};
  for (const l of linhas) {
    const m = (brutos[l.agentKey] ??= { agentId: l.agentKey, versao: l.versao, cor: l.cor ?? undefined, motor: "sprite", estados: {}, pequeno: {} });
    const arquivo = l.tamanho === "p" ? `${l.estado}.sm.webp` : `${l.estado}.webp`;
    (l.tamanho === "p" ? m.pequeno : m.estados)[l.estado] = urlQuadroBanco(l.agentKey, arquivo, l.versao);
  }
  const out: Record<string, AvatarManifest> = {};
  for (const raw of Object.values(brutos)) {
    const m = normalizarManifest(raw);
    if (m) out[m.agentId] = m;
  }
  return out;
}

/** Substitui o set inteiro do agente (apaga + cria numa transação). */
export async function salvarNoBanco(agentKey: string, set: SetParaSalvar): Promise<string> {
  const versao = Date.now().toString(36);
  // Prisma Bytes = Uint8Array<ArrayBuffer> (Buffer do Node pode ser SharedArrayBuffer no tipo)
  const bytes = (b: Buffer) => Uint8Array.from(b);
  const linhas: { agentKey: string; estado: string; tamanho: string; dados: Uint8Array<ArrayBuffer>; versao: string; cor: string | null }[] = [
    { agentKey, estado: "base", tamanho: "base", dados: bytes(set.base), versao, cor: set.cor ?? null },
  ];
  for (const [estado, q] of Object.entries(set.quadros) as [EstadoSprite, NonNullable<SetParaSalvar["quadros"][EstadoSprite]>][]) {
    linhas.push({ agentKey, estado, tamanho: "g", dados: bytes(q.grande), versao, cor: set.cor ?? null });
    linhas.push({ agentKey, estado, tamanho: "p", dados: bytes(q.pequeno), versao, cor: set.cor ?? null });
  }
  await prisma.$transaction([
    prisma.agentAvatarQuadro.deleteMany({ where: { agentKey } }),
    prisma.agentAvatarQuadro.createMany({ data: linhas }),
  ]);
  return versao;
}

export async function apagarDoBanco(agentKey: string): Promise<number> {
  const r = await prisma.agentAvatarQuadro.deleteMany({ where: { agentKey } });
  return r.count;
}

/** "idle.webp" | "idle.sm.webp" | "base.webp" → bytes (ou null). */
export async function lerQuadroBanco(agentKey: string, arquivo: string): Promise<{ dados: Buffer; mime: string } | null> {
  const m = /^([a-z_]+?)(\.sm)?\.webp$/.exec(arquivo);
  if (!m) return null;
  const estado = m[1];
  const tamanho = estado === "base" ? "base" : m[2] ? "p" : "g";
  const q = await prisma.agentAvatarQuadro.findUnique({
    where: { agentKey_estado_tamanho: { agentKey, estado, tamanho } },
    select: { dados: true, mime: true },
  });
  return q ? { dados: Buffer.from(q.dados), mime: q.mime } : null;
}
