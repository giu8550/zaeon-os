/**
 * lib/whatsapp/service.ts — orquestração SERVER do Mentor no WhatsApp (Prisma + sender + cérebro).
 *
 *   startLink       → gera o código + QR wa.me (não pareia a conta do aluno)
 *   handleInbound   → CONECTAR-<code> liga · PARE/VOLTAR · resto = turno do mentor (brain.ts)
 *   notifyWhatsApp  → envio de saída respeitando opt-in/quiet-hours + idempotência (dedupeKey)
 *   runDispatch     → agenda do dia / revisão espaçada / prazos (dispatch.ts) na voz do mentor
 *   notifyCredential / notifyTreeProgress → ganchos event-driven (Solana / skill tree)
 */
import { prisma } from "@/src/lib/prisma";
import { normalizePlan, type PlanState } from "@/lib/plans";
import { connectText, newVerifyCode, parseInbound, waMeUrl } from "./link";
import { toE164 } from "./phone";
import { canSend, localParts, normalizeQuiet, whatsappAllowed, type CanSend } from "./policy";
import { sendWhatsAppText } from "./sender";
import { inMentorVoice } from "./voice";
import { agendaFacts, agendaForWeekday, deadlineFacts, dueKinds, reviewCandidates, reviewFacts } from "./dispatch";
import type { InboundMsg } from "./inbound";

const CODE_TTL_MS = 24 * 3_600_000;
const MAX_LINKS_PER_TICK = 200;

export function platformPhone(env: Record<string, string | undefined> = process.env): string | null {
  return toE164(env.WHATSAPP_PLATFORM_PHONE ?? "");
}

async function planOf(userId: string): Promise<PlanState | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, plusUntil: true, trialGranted: true } });
  if (!u) return null;
  return { plan: normalizePlan(u.plan), plusUntil: u.plusUntil ?? null, trialGranted: !!u.trialGranted };
}

/** Mentor ativo (contexto + nome) do aluno — pra voz dos disparos. null = Aura base. */
async function mentorOf(userId: string): Promise<{ context: string; name: string; slug: string } | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { activeMentorId: true } });
  if (!u?.activeMentorId) return null;
  const { resolveMentor } = await import("@/lib/agent/mentors-server");
  const m = await resolveMentor(u.activeMentorId, userId).catch(() => null);
  return m ? { context: m.context, name: m.name, slug: m.slug } : null;
}

async function log(userId: string, dir: "in" | "out", kind: string, text: string, dedupeKey?: string | null) {
  try {
    await prisma.whatsAppMessage.create({ data: { userId, dir, kind, text: text.slice(0, 4000), dedupeKey: dedupeKey ?? null } });
  } catch (e) { console.warn("[whatsapp] log falhou:", (e as any)?.message ?? e); }
}

// ───────────────────────────── 1. onboarding por QR ─────────────────────────────
export type StartLinkResult =
  | { ok: true; code: string; waUrl: string; qrDataUrl: string; platformPhone: string; alreadyLinked: boolean }
  | { ok: false; error: "not_configured" | "plan_required" | "no_user" };

export async function startLink(userId: string): Promise<StartLinkResult> {
  const platform = platformPhone();
  if (!platform) return { ok: false, error: "not_configured" };
  const plan = await planOf(userId);
  if (!plan) return { ok: false, error: "no_user" };
  if (!whatsappAllowed(plan)) return { ok: false, error: "plan_required" };

  const code = newVerifyCode();
  const existing = await prisma.whatsAppLink.findUnique({ where: { userId } });
  await prisma.whatsAppLink.upsert({
    where: { userId },
    create: { userId, verifyCode: code, codeIssuedAt: new Date() },
    update: { verifyCode: code, codeIssuedAt: new Date() },
  });
  const waUrl = waMeUrl(platform, connectText(code));
  const QR = await import("qrcode");
  const qrDataUrl = await QR.toDataURL(waUrl, { margin: 1, width: 320, errorCorrectionLevel: "M" });
  return { ok: true, code, waUrl, qrDataUrl, platformPhone: platform, alreadyLinked: !!existing?.verified };
}

export type LinkStatus = { configured: boolean; allowed: boolean; linked: boolean; verified: boolean; optIn: boolean; phoneMasked: string | null; quietHours: { start: number; end: number; tz?: string }; pendingCode: boolean; linkedAt: string | null };

export async function getLinkStatus(userId: string): Promise<LinkStatus> {
  const [link, plan] = await Promise.all([prisma.whatsAppLink.findUnique({ where: { userId } }), planOf(userId)]);
  const masked = link?.phone ? link.phone.replace(/^(\+\d{2})\d+(\d{4})$/, "$1 ••••• $2") : null;
  return {
    configured: !!platformPhone(),
    allowed: plan ? whatsappAllowed(plan) : false,
    linked: !!link?.verified,
    verified: !!link?.verified,
    optIn: !!link?.optIn,
    phoneMasked: masked,
    quietHours: normalizeQuiet(link?.quietHours),
    pendingCode: !!link?.verifyCode && !link?.verified,
    linkedAt: link?.linkedAt ? link.linkedAt.toISOString() : null,
  };
}

/** Desliga: opt-out + desverifica (o número fica no registro só pra auditoria). */
export async function unlink(userId: string): Promise<void> {
  await prisma.whatsAppLink.updateMany({ where: { userId }, data: { optIn: false, verified: false, verifyCode: null } });
}

export async function setQuietHours(userId: string, q: unknown): Promise<void> {
  await prisma.whatsAppLink.updateMany({ where: { userId }, data: { quietHours: normalizeQuiet(q) as any } });
}

// ───────────────────────────── 2. inbound (mão-dupla) ─────────────────────────────
export type InboundAction = "connected" | "invalid_code" | "stopped" | "resumed" | "replied" | "unknown_phone" | "plan_required";
export type InboundResult = { action: InboundAction; userId?: string; reply?: string; sent?: boolean };

async function reply(userId: string, phone: string, kind: string, text: string, agentKey = "aura"): Promise<boolean> {
  const r = await sendWhatsAppText(phone, text, process.env, { agentKey, idemKey: `reply:${userId}:${kind}:${Date.now()}` });
  await log(userId, "out", kind, text);
  await prisma.whatsAppLink.updateMany({ where: { userId }, data: { lastMsgAt: new Date() } });
  if (!r.ok) console.warn("[whatsapp] envio falhou:", r);
  return r.ok;
}

export async function handleInbound(msg: InboundMsg, now: Date = new Date()): Promise<InboundResult> {
  const intent = parseInbound(msg.text);

  // CONECTAR-<code>: mapeia telefone ↔ userId (o envio do código É o consentimento)
  if (intent.kind === "connect") {
    const link = await prisma.whatsAppLink.findFirst({ where: { verifyCode: intent.code } });
    const fresh = !!link?.codeIssuedAt && now.getTime() - link.codeIssuedAt.getTime() <= CODE_TTL_MS;
    if (!link || !fresh) {
      // só responde a quem mandou um código no formato certo (evita falar com estranhos)
      const text = "Esse código não vale mais. Gera um QR novo no seu perfil da Zaeon e escaneia de novo. 🙂";
      await sendWhatsAppText(msg.phone, text);
      return { action: "invalid_code", reply: text };
    }
    await prisma.whatsAppLink.update({
      where: { id: link.id },
      data: { phone: msg.phone, verified: true, optIn: true, verifyCode: null, linkedAt: now, lastMsgAt: now },
    });
    // solta o número de um vínculo antigo de OUTRO usuário (troca de dono do chip)
    await prisma.whatsAppLink.updateMany({ where: { phone: msg.phone, userId: { not: link.userId } }, data: { verified: false, optIn: false } });
    try { await prisma.user.updateMany({ where: { id: link.userId, phone: null }, data: { phone: msg.phone } }); } catch { /* opcional */ }
    await log(link.userId, "in", "connect", msg.text);
    const [mentor, u] = await Promise.all([mentorOf(link.userId), prisma.user.findUnique({ where: { id: link.userId }, select: { name: true } })]);
    const text = await inMentorVoice({ kind: "welcome", facts: "O aluno acabou de conectar o WhatsApp.", mentorContext: mentor?.context, mentorName: mentor?.name, studentName: u?.name });
    const sent = await reply(link.userId, msg.phone, "welcome", text, mentor?.slug ?? "aura");
    return { action: "connected", userId: link.userId, reply: text, sent };
  }

  const link = await prisma.whatsAppLink.findFirst({ where: { phone: msg.phone, verified: true }, orderBy: { linkedAt: "desc" } });
  if (!link) return { action: "unknown_phone" }; // silêncio: não conversamos com número desconhecido
  const userId = link.userId;
  await prisma.whatsAppLink.update({ where: { id: link.id }, data: { lastMsgAt: now } });

  if (intent.kind === "stop") {
    await prisma.whatsAppLink.update({ where: { id: link.id }, data: { optIn: false } });
    await log(userId, "in", "stop", msg.text);
    const text = "Combinado, parei de mandar mensagens. Quando quiser retomar, é só responder VOLTAR.";
    const sent = await reply(userId, msg.phone, "stop", text);
    return { action: "stopped", userId, reply: text, sent };
  }
  if (intent.kind === "resume") {
    await prisma.whatsAppLink.update({ where: { id: link.id }, data: { optIn: true } });
    await log(userId, "in", "resume", msg.text);
    const text = "Voltei! Vou retomar sua agenda, lembretes e revisões por aqui. 🙂";
    const sent = await reply(userId, msg.phone, "resume", text);
    return { action: "resumed", userId, reply: text, sent };
  }

  // conversa → o mentor responde (harness + memória). Gate de plano vale também aqui.
  await log(userId, "in", "chat", intent.text);
  const plan = await planOf(userId);
  if (plan && !whatsappAllowed(plan)) {
    const text = "O mentor no WhatsApp faz parte do plano Plus. Ative na Zaeon (estudante com e-mail acadêmico ganha 30 dias) e a gente continua por aqui.";
    const sent = await reply(userId, msg.phone, "chat", text);
    return { action: "plan_required", userId, reply: text, sent };
  }
  const { answerOnWhatsApp } = await import("./brain");
  const out = await answerOnWhatsApp({ userId, text: intent.text });
  const sent = await reply(userId, msg.phone, "chat", out.text, out.mentor ?? "aura");
  return { action: "replied", userId, reply: out.text, sent };
}

// ───────────────────────────── 3. outbound (disparos) ─────────────────────────────
export type NotifyInput = { userId: string; kind: string; text: string; dedupeKey?: string | null; ignoreQuiet?: boolean; now?: Date; agentKey?: string };
export type NotifyReason = Exclude<CanSend, { ok: true }>["reason"] | "duplicate" | "no_link" | "send_failed" | "plan_required";
export type NotifyResult = { sent: true; reason?: undefined } | { sent: false; reason: NotifyReason };

export async function notifyWhatsApp(input: NotifyInput): Promise<NotifyResult> {
  const now = input.now ?? new Date();
  const link = await prisma.whatsAppLink.findUnique({ where: { userId: input.userId } });
  if (!link) return { sent: false, reason: "no_link" };
  const can = canSend(link, now, { ignoreQuiet: input.ignoreQuiet });
  if (!can.ok) return { sent: false, reason: can.reason };
  const plan = await planOf(input.userId);
  if (plan && !whatsappAllowed(plan, process.env, now)) return { sent: false, reason: "plan_required" };
  if (input.dedupeKey) {
    const dup = await prisma.whatsAppMessage.findFirst({ where: { userId: input.userId, dedupeKey: input.dedupeKey }, select: { id: true } });
    if (dup) return { sent: false, reason: "duplicate" };
  }
  const r = await sendWhatsAppText(link.phone!, input.text, process.env, {
    agentKey: input.agentKey ?? "aura",
    idemKey: input.dedupeKey ? `notify:${input.userId}:${input.dedupeKey}` : undefined,
  });
  if (!r.ok) { console.warn("[whatsapp] disparo falhou:", r); return { sent: false, reason: "send_failed" }; }
  await log(input.userId, "out", input.kind, input.text, input.dedupeKey);
  await prisma.whatsAppLink.update({ where: { id: link.id }, data: { lastMsgAt: now } });
  return { sent: true };
}

/** Disparo na voz do mentor a partir de fatos (usado pelos ganchos e pelo scheduler). */
export async function notifyInVoice(userId: string, kind: string, facts: string, dedupeKey?: string | null, ignoreQuiet?: boolean): Promise<NotifyResult> {
  const link = await prisma.whatsAppLink.findUnique({ where: { userId } });
  if (!link) return { sent: false, reason: "no_link" };
  const can = canSend(link, new Date(), { ignoreQuiet });
  if (!can.ok) return { sent: false, reason: can.reason };
  if (dedupeKey) {
    const dup = await prisma.whatsAppMessage.findFirst({ where: { userId, dedupeKey }, select: { id: true } });
    if (dup) return { sent: false, reason: "duplicate" };
  }
  const [mentor, u] = await Promise.all([mentorOf(userId), prisma.user.findUnique({ where: { id: userId }, select: { name: true } })]);
  const text = await inMentorVoice({ kind, facts, mentorContext: mentor?.context, mentorName: mentor?.name, studentName: u?.name });
  return notifyWhatsApp({ userId, kind, text, dedupeKey, ignoreQuiet, agentKey: mentor?.slug ?? "aura" });
}

/** Gancho: credencial verificável conquistada (Solana). Chame quando o mint confirmar. */
export function notifyCredential(userId: string, label: string, ref?: string): Promise<NotifyResult> {
  return notifyInVoice(userId, "credential", `Você acabou de ganhar uma credencial verificável na Solana: "${label}".`, ref ? `credential:${ref}` : null, true);
}

/** Gancho: progresso na árvore de conhecimento (ex.: "a 1 nó de desbloquear Termodinâmica II"). */
export function notifyTreeProgress(userId: string, facts: string, ref?: string): Promise<NotifyResult> {
  return notifyInVoice(userId, "tree", facts, ref ? `tree:${ref}` : null);
}

// ───────────────────────────── 4. scheduler ─────────────────────────────
export type DispatchSummary = { users: number; sent: number; skipped: number; errors: number; details: { userId: string; kind: string; result: string }[] };

export async function runDispatch(now: Date = new Date()): Promise<DispatchSummary> {
  const links = await prisma.whatsAppLink.findMany({ where: { verified: true, optIn: true, phone: { not: null } }, take: MAX_LINKS_PER_TICK });
  const summary: DispatchSummary = { users: links.length, sent: 0, skipped: 0, errors: 0, details: [] };
  const since = new Date(now.getTime() - 2 * 86_400_000);

  for (const link of links) {
    const userId = link.userId;
    try {
      const q = normalizeQuiet(link.quietHours);
      const tz = q.tz!;
      const recent = await prisma.whatsAppMessage.findMany({ where: { userId, at: { gte: since }, dedupeKey: { not: null } }, select: { dedupeKey: true } });
      const sentKeys = new Set(recent.map((m) => m.dedupeKey!).filter(Boolean));
      const due = dueKinds(now, tz, sentKeys);
      const jobs: { kind: string; facts: string; dedupeKey: string }[] = [];

      for (const d of due) {
        if (d.kind === "agenda") {
          const space = await prisma.userSpaceData.findUnique({ where: { userId }, select: { schedule: true } });
          const { weekday } = localParts(now, tz);
          const facts = agendaFacts(agendaForWeekday(space?.schedule, weekday), weekday);
          if (facts) jobs.push({ kind: "agenda", facts, dedupeKey: d.dedupeKey });
          else await log(userId, "out", "skip", "sem agenda hoje", d.dedupeKey); // avalia 1x/dia
        } else if (d.kind === "review") {
          const progs = await prisma.aulaProgress.findMany({ where: { studentId: userId, status: "completed" }, select: { aulaId: true, updatedAt: true }, take: 200 });
          const aulas = progs.length ? await prisma.aula.findMany({ where: { id: { in: progs.map((p) => p.aulaId) } }, select: { id: true, title: true } }) : [];
          const title = new Map(aulas.map((a) => [a.id, a.title]));
          const rows = progs.filter((p) => title.has(p.aulaId)).map((p) => ({ title: title.get(p.aulaId)!, completedAt: p.updatedAt }));
          const facts = reviewFacts(reviewCandidates(rows, now));
          if (facts) jobs.push({ kind: "review", facts, dedupeKey: d.dedupeKey });
          else await log(userId, "out", "skip", "sem revisão hoje", d.dedupeKey);
        }
      }

      // prazos (event-like: dedupe por documento, sem hora fixa)
      const docs = await prisma.teacherDocument.findMany({
        where: { assignedTo: { has: userId }, status: "published", dueAt: { gte: now, lte: new Date(now.getTime() + 48 * 3_600_000) } },
        select: { id: true, title: true, dueAt: true },
      });
      for (const f of deadlineFacts(docs.map((d) => ({ id: d.id, title: d.title, dueAt: d.dueAt! })), now)) {
        if (!sentKeys.has(f.dedupeKey)) jobs.push({ kind: "deadline", facts: f.text, dedupeKey: f.dedupeKey });
      }

      for (const j of jobs) {
        const r = await notifyInVoice(userId, j.kind, j.facts, j.dedupeKey);
        summary.details.push({ userId, kind: j.kind, result: r.sent ? "sent" : String(r.reason) });
        if (r.sent) summary.sent++; else summary.skipped++;
      }
    } catch (e) {
      summary.errors++;
      summary.details.push({ userId, kind: "tick", result: `error: ${(e as any)?.message ?? e}` });
    }
  }
  return summary;
}
