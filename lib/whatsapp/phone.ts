/**
 * lib/whatsapp/phone.ts — normalização de telefone (E.164) e jid do WhatsApp. PURO.
 *
 * O Evolution/Baileys identifica o contato por `jid` (`5511999999999@s.whatsapp.net`);
 * o app guarda E.164 (`+5511999999999`, mesmo formato de `User.phone`). Default BR (+55).
 */

const DEFAULT_CC = "55";

/** Normaliza qualquer formato humano pra E.164. null se não parece telefone. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const hasPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D+/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (hasPlus) return `+${digits}`;
  // BR sem DDI: 10 (fixo) ou 11 (celular) dígitos → prefixa 55
  if (digits.length === 10 || digits.length === 11) return `+${DEFAULT_CC}${digits}`;
  // já veio com DDI (ex.: 5511999999999)
  return `+${digits}`;
}

/** jid de usuário → E.164. Grupos (`@g.us`), broadcast e lid → null. */
export function phoneFromJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const at = jid.indexOf("@");
  if (at <= 0) return null;
  const domain = jid.slice(at + 1);
  if (domain !== "s.whatsapp.net" && domain !== "c.us") return null;
  const num = jid.slice(0, at).split(":")[0];
  if (!/^\d{8,15}$/.test(num)) return null;
  return `+${num}`;
}

/** E.164 → dígitos puros (o `number` que o Evolution/wa.me esperam). */
export function jidNumber(phone: string): string {
  return phone.replace(/\D+/g, "");
}
