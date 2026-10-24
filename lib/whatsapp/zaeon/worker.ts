/**
 * lib/whatsapp/zaeon/worker.ts — o WORKER da Zaeon proativa. Um tick (chamado pelo dispatch do server.js a cada
 * poucos minutos) olha o relógio de cada pessoa conectada e decide (rotina.ts) se é hora de falar: lembrete,
 * manhã/tarde/noite (com rotina) ou descoberta a cada 45 min (sem rotina). Compõe com o template (template.ts,
 * contexto real) e manda pelos chips (notifyWhatsApp → sender "chips"). Idempotente pela chave da ação.
 * Liga com ZAEON_PROATIVA=1 (com ela ligada, o dispatch antigo de agenda/revisão sai do ar: a Zaeon cobre).
 */
import { horariosDoEnv, oQueMandar, SEM_ROTINA_A_CADA_MIN, type Lembrete } from "./rotina";

export const zaeonLigada = (env: Record<string, string | undefined> = process.env) => env.ZAEON_PROATIVA === "1";

export type ResumoZaeon = { pessoas: number; enviadas: number; puladas: number; erros: number; detalhes: { userId: string; acao: string; resultado: string; texto?: string }[] };

/**
 * `o.seco`: compõe a mensagem de verdade (dados reais + modelo) e devolve o TEXTO sem mandar — o feedback antes
 * de ligar. `o.userId`: só esta pessoa (o seco exige). `o.forcar`: ignora a hora/dedupe e usa esta ação (teste do template).
 */
export async function runZaeon(agora: Date = new Date(), o: { seco?: boolean; userId?: string; forcar?: "manha" | "tarde" | "noite" | "descoberta" } = {}): Promise<ResumoZaeon> {
  const { prisma } = await import("@/src/lib/prisma");
  const { inQuietHours, localParts, normalizeQuiet } = await import("../policy");
  const { notifyWhatsApp } = await import("../service");
  const { montarContexto } = await import("./contexto");
  const { comporMensagem } = await import("./template");
  const horarios = horariosDoEnv(process.env.ZAEON_HORARIOS);
  const cada = Math.max(15, Number(process.env.ZAEON_SEM_ROTINA_MIN) || SEM_ROTINA_A_CADA_MIN);

  let links = o.userId
    ? await prisma.whatsAppLink.findMany({ where: { userId: o.userId } })
    : await prisma.whatsAppLink.findMany({ where: { verified: true, optIn: true, phone: { not: null } }, take: 500 });
  // o seco serve pra ver a mensagem ANTES da pessoa vincular o WhatsApp (o dono testando o template)
  if (o.seco && o.userId && !links.length) links = [{ userId: o.userId, quietHours: null } as (typeof links)[number]];
  const r: ResumoZaeon = { pessoas: links.length, enviadas: 0, puladas: 0, erros: 0, detalhes: [] };
  const desde = new Date(agora.getTime() - 2 * 86_400_000);

  for (const link of links) {
    const userId = link.userId;
    try {
      if (!o.forcar && inQuietHours(link.quietHours, agora)) { r.puladas++; continue; }
      const tz = normalizeQuiet(link.quietHours).tz!;
      const lp = localParts(agora, tz);
      const [lembretes, space, recentes] = await Promise.all([
        prisma.zaeonLembrete.findMany({ where: { userId, ativo: true } }),
        prisma.userSpaceData.findUnique({ where: { userId }, select: { schedule: true } }),
        prisma.whatsAppMessage.findMany({ where: { userId, at: { gte: desde } }, select: { dir: true, kind: true, dedupeKey: true, at: true }, orderBy: { at: "desc" } }),
      ]);
      const ultimaProativa = recentes.find((m) => m.dir === "out" && m.kind.startsWith("zaeon:"));
      const acaoDoRelogio = oQueMandar({
        minutoDoDia: lp.hour * 60 + lp.minute, dia: lp.weekday % 7, dataKey: lp.dateKey, quieto: false,
        lembretes: lembretes as Lembrete[], itensDeAgenda: Array.isArray(space?.schedule) ? (space!.schedule as unknown[]).length : 0,
        enviadas: new Set(recentes.map((m) => m.dedupeKey).filter((k): k is string => !!k)),
        ultimoProativoMin: ultimaProativa ? Math.floor((agora.getTime() - ultimaProativa.at.getTime()) / 60_000) : null,
        descobertasHoje: recentes.filter((m) => m.dedupeKey?.startsWith(`zaeon:descoberta:${lp.dateKey}:`)).length,
        horarios, cadaMin: cada,
      });
      const acao = o.forcar
        ? (o.forcar === "descoberta" ? { tipo: "descoberta" as const, chave: "teste", tentativa: 1 } : { tipo: "momento" as const, momento: o.forcar, chave: "teste" })
        : acaoDoRelogio;
      if (!acao) { r.puladas++; continue; }

      const ctx = await montarContexto(userId, agora, { weekday: lp.weekday, dataKey: lp.dateKey });
      const { texto } = await comporMensagem(acao, ctx);
      const kind = `zaeon:${acao.tipo === "momento" ? acao.momento : acao.tipo}`;
      if (o.seco) { r.detalhes.push({ userId, acao: kind, resultado: "seco (não enviada)", texto }); continue; }
      const env = await notifyWhatsApp({ userId, kind, text: texto, dedupeKey: acao.chave, agentKey: "zaeon", now: agora });
      r.detalhes.push({ userId, acao: kind, resultado: env.sent ? "enviada" : String(env.reason) });
      if (env.sent) {
        r.enviadas++;
        if (acao.tipo === "lembrete") {
          // lembrete de uma vez só (com data) se aposenta depois de sair
          await prisma.zaeonLembrete.update({ where: { id: acao.lembrete.id }, data: { ultimoEnvioEm: agora, ...(acao.lembrete.data ? { ativo: false } : {}) } });
        }
      } else r.puladas++;
    } catch (e) {
      r.erros++;
      r.detalhes.push({ userId, acao: "tick", resultado: `erro: ${String((e as Error)?.message ?? e).slice(0, 160)}` });
    }
  }
  return r;
}
