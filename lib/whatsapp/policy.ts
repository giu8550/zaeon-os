/**
 * lib/whatsapp/policy.ts — consentimento e "não incomodar". PURO (sem IO).
 *
 * Regras (spec §6): só manda se `verified` + `optIn` + telefone; respeita quiet hours
 * (default 22h→7h em America/Sao_Paulo); gate de plano (WhatsApp = Plus; `WHATSAPP_OPEN_TO_ALL=1`
 * abre pra todos — decisão do dono).
 */
import { whatsappEnabled, type PlanState } from "@/lib/plans";

export type QuietHours = { start: number; end: number; tz?: string };
export const DEFAULT_TZ = "America/Sao_Paulo";
export const DEFAULT_QUIET: QuietHours = { start: 22, end: 7, tz: DEFAULT_TZ };

export type LocalParts = { hour: number; minute: number; weekday: number; dateKey: string };

/** Hora local num fuso IANA sem lib externa (Intl). weekday: 1=Seg … 7=Dom (mesmo do agenda). */
export function localParts(now: Date, tz: string = DEFAULT_TZ): LocalParts {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false, weekday: "short",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(now);
  } catch {
    return localParts(now, DEFAULT_TZ);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24; // "24" à meia-noite em alguns runtimes
  const wd: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    hour,
    minute: Number(get("minute")),
    weekday: wd[get("weekday")] ?? 1,
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export function normalizeQuiet(q: unknown): QuietHours {
  const o = (q && typeof q === "object" ? q : {}) as Partial<QuietHours>;
  const start = Number.isFinite(o.start) ? Number(o.start) : DEFAULT_QUIET.start;
  const end = Number.isFinite(o.end) ? Number(o.end) : DEFAULT_QUIET.end;
  return { start: ((start % 24) + 24) % 24, end: ((end % 24) + 24) % 24, tz: typeof o.tz === "string" && o.tz ? o.tz : DEFAULT_TZ };
}

/** true se `now` cai dentro da janela [start, end) — suporta janela que cruza meia-noite. */
export function inQuietHours(q: unknown, now: Date): boolean {
  const { start, end, tz } = normalizeQuiet(q);
  if (start === end) return false;
  const { hour } = localParts(now, tz);
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export type SendableLink = { verified: boolean; optIn: boolean; phone: string | null; quietHours?: unknown };
export type CanSend = { ok: true } | { ok: false; reason: "not_verified" | "opted_out" | "no_phone" | "quiet_hours" };

export function canSend(link: SendableLink, now: Date, opts?: { ignoreQuiet?: boolean }): CanSend {
  if (!link.verified) return { ok: false, reason: "not_verified" };
  if (!link.optIn) return { ok: false, reason: "opted_out" };
  if (!link.phone) return { ok: false, reason: "no_phone" };
  if (!opts?.ignoreQuiet && inQuietHours(link.quietHours ?? null, now)) return { ok: false, reason: "quiet_hours" };
  return { ok: true };
}

/** Gate de plano: WhatsApp = Plus (lib/plans). `WHATSAPP_OPEN_TO_ALL=1` libera pra todos. */
export function whatsappAllowed(plan: PlanState, env: Record<string, string | undefined> = process.env, now?: Date): boolean {
  if (env.WHATSAPP_OPEN_TO_ALL === "1" || env.WHATSAPP_OPEN_TO_ALL === "true") return true;
  return whatsappEnabled(plan, now);
}
