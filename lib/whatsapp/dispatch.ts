/**
 * lib/whatsapp/dispatch.ts — COMPOSIÇÃO dos disparos do mentor (spec §4). PURO (sem IO).
 *
 * Cada função transforma dados que já existem no app em "fatos" curtos; a voz do mentor
 * (lib/whatsapp/voice.ts) reescreve os fatos em mensagem. O que roda quando (dueKinds) é
 * determinístico e idempotente por dedupeKey ("agenda:YYYY-MM-DD") — o scheduler pode
 * tickar quantas vezes quiser.
 *
 *   agenda   → UserSpaceData.schedule (a agenda da Sala de Aula: {name, days[1..7], hour, endHour…})
 *   review   → revisão espaçada: aulas concluídas em D+1/3/7/14/30 (AulaProgress.completed)
 *   deadline → TeacherDocument.dueAt nas próximas 48h
 *   tree / credential → event-driven (hooks em service.ts)
 */
import { localParts } from "./policy";

export const WEEKDAY_LABEL: Record<number, string> = {
  1: "segunda", 2: "terça", 3: "quarta", 4: "quinta", 5: "sexta", 6: "sábado", 7: "domingo",
};

export type AgendaItem = { name: string; hour?: number; endHour?: number; teacher?: string; room?: string; detail?: string };

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const s = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Itens da agenda de um dia da semana (1=Seg … 7=Dom), ordenados por hora (sem hora → fim). */
export function agendaForWeekday(schedule: unknown, weekday: number): AgendaItem[] {
  if (!Array.isArray(schedule)) return [];
  const out: AgendaItem[] = [];
  for (const raw of schedule) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as any;
    const days: number[] = Array.isArray(c.days) ? c.days.map(Number) : num(c.day) ? [Number(c.day)] : [];
    if (!days.includes(weekday) || c.isDraft) continue;
    const name = s(c.name);
    if (!name) continue;
    const hour = num(c.hour);
    const endHour = num(c.endHour) ?? (hour !== undefined && num(c.duration) ? hour + Number(c.duration) : undefined);
    out.push({ name, hour, endHour, teacher: s(c.teacher), room: s(c.room), detail: s(c.detail) });
  }
  return out.sort((a, b) => (a.hour ?? 99) - (b.hour ?? 99));
}

/** "Agenda de hoje (quarta): Cálculo I 8h–10h (Prof. Ana, B12); …" — "" se não há nada. */
export function agendaFacts(items: AgendaItem[], weekday: number): string {
  if (!items.length) return "";
  const parts = items.map((i) => {
    const when = i.hour !== undefined ? ` ${i.hour}h${i.endHour !== undefined ? `–${i.endHour}h` : ""}` : "";
    const extras = [i.teacher ? `Prof. ${i.teacher}` : "", i.room ?? "", i.detail ?? ""].filter(Boolean);
    return `${i.name}${when}${extras.length ? ` (${extras.join(", ")})` : ""}`;
  });
  return `Agenda de hoje (${WEEKDAY_LABEL[weekday] ?? "hoje"}): ${parts.join("; ")}.`;
}

export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30];

export type ReviewRow = { title: string; completedAt: Date };
export type ReviewCandidate = { title: string; daysAgo: number };

/** Revisão espaçada: itens concluídos há exatamente N dias (N em `intervals`), do mais recente ao mais antigo. */
export function reviewCandidates(rows: ReviewRow[], now: Date, intervals: number[] = REVIEW_INTERVALS_DAYS): ReviewCandidate[] {
  const out: ReviewCandidate[] = [];
  for (const r of rows) {
    const daysAgo = Math.floor((now.getTime() - r.completedAt.getTime()) / 86_400_000);
    if (intervals.includes(daysAgo)) out.push({ title: r.title, daysAgo });
  }
  return out.sort((a, b) => a.daysAgo - b.daysAgo);
}

export function reviewFacts(c: ReviewCandidate[]): string {
  if (!c.length) return "";
  const top = c.slice(0, 3).map((x) => `${x.title} (há ${x.daysAgo} dia${x.daysAgo === 1 ? "" : "s"})`);
  return `Revisão espaçada de hoje: ${top.join("; ")}. Proponha UMA pergunta rápida de recall sobre o primeiro item.`;
}

export type DeadlineDoc = { id: string; title: string; dueAt: Date };
export type DeadlineFact = { id: string; text: string; dedupeKey: string };

/** Prazos que vencem nas próximas `withinHours` (não vencidos). dedupeKey por documento. */
export function deadlineFacts(docs: DeadlineDoc[], now: Date, withinHours = 48): DeadlineFact[] {
  const out: DeadlineFact[] = [];
  for (const d of docs) {
    const ms = d.dueAt.getTime() - now.getTime();
    if (ms < 0 || ms > withinHours * 3_600_000) continue;
    const h = Math.round(ms / 3_600_000);
    const when = h <= 1 ? "em menos de 1 hora" : h < 24 ? `em ${h} horas` : h < 36 ? "amanhã" : `em ${Math.round(h / 24)} dias`;
    out.push({ id: d.id, dedupeKey: `deadline:${d.id}`, text: `Prazo chegando: "${d.title}" vence ${when}.` });
  }
  return out;
}

export type DueKind = { kind: "agenda" | "review"; dedupeKey: string };
export type DueOpts = { digestHour?: number; reviewHour?: number };

/** O que está devido AGORA pra este usuário (dado o que já foi enviado hoje). */
export function dueKinds(now: Date, tz: string, sentKeys: Set<string>, opts: DueOpts = {}): DueKind[] {
  const { hour, dateKey } = localParts(now, tz);
  const digestHour = opts.digestHour ?? 7;
  const reviewHour = opts.reviewHour ?? 16;
  const out: DueKind[] = [];
  const agendaKey = `agenda:${dateKey}`;
  const reviewKey = `review:${dateKey}`;
  if (hour >= digestHour && !sentKeys.has(agendaKey)) out.push({ kind: "agenda", dedupeKey: agendaKey });
  if (hour >= reviewHour && !sentKeys.has(reviewKey)) out.push({ kind: "review", dedupeKey: reviewKey });
  return out;
}
