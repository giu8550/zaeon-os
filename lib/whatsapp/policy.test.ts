import { describe, it, expect } from "vitest";
import { localParts, inQuietHours, canSend, whatsappAllowed, DEFAULT_QUIET } from "./policy";

const SP = "America/Sao_Paulo";
// 2026-09-09 (quarta) 10:30 em São Paulo = 13:30Z
const morning = new Date("2026-09-09T13:30:00Z");
// 2026-09-09 23:15 em São Paulo = 2026-09-10T02:15Z
const night = new Date("2026-09-10T02:15:00Z");

describe("whatsapp · policy", () => {
  it("localParts: hora/dia da semana/dateKey no fuso", () => {
    const p = localParts(morning, SP);
    expect(p.hour).toBe(10);
    expect(p.minute).toBe(30);
    expect(p.weekday).toBe(3); // quarta (1=seg … 7=dom)
    expect(p.dateKey).toBe("2026-09-09");
    expect(localParts(night, SP).dateKey).toBe("2026-09-09");
    expect(localParts(new Date("2026-09-13T12:00:00Z"), SP).weekday).toBe(7); // domingo
  });
  it("inQuietHours: janela cruzando meia-noite (22→7) e janela normal (13→14)", () => {
    expect(inQuietHours(DEFAULT_QUIET, morning)).toBe(false);
    expect(inQuietHours(DEFAULT_QUIET, night)).toBe(true);
    expect(inQuietHours({ start: 13, end: 14, tz: SP }, morning)).toBe(false);
    expect(inQuietHours({ start: 10, end: 11, tz: SP }, morning)).toBe(true);
    expect(inQuietHours(null, night)).toBe(true); // default 22→7
  });
  it("canSend: exige verified + optIn + phone, e fora do quiet-hours", () => {
    const base = { verified: true, optIn: true, phone: "+5511999999999", quietHours: null };
    expect(canSend(base, morning)).toEqual({ ok: true });
    expect(canSend({ ...base, verified: false }, morning)).toEqual({ ok: false, reason: "not_verified" });
    expect(canSend({ ...base, optIn: false }, morning)).toEqual({ ok: false, reason: "opted_out" });
    expect(canSend({ ...base, phone: null }, morning)).toEqual({ ok: false, reason: "no_phone" });
    expect(canSend(base, night)).toEqual({ ok: false, reason: "quiet_hours" });
    expect(canSend(base, night, { ignoreQuiet: true })).toEqual({ ok: true });
  });
  it("whatsappAllowed: Plus passa; free não; WHATSAPP_OPEN_TO_ALL=1 abre", () => {
    const free = { plan: "free" as const, plusUntil: null, trialGranted: false };
    const plus = { plan: "plus" as const, plusUntil: new Date("2030-01-01"), trialGranted: true };
    expect(whatsappAllowed(plus, {})).toBe(true);
    expect(whatsappAllowed(free, {})).toBe(false);
    expect(whatsappAllowed(free, { WHATSAPP_OPEN_TO_ALL: "1" })).toBe(true);
  });
});
