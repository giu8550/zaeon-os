/**
 * lib/whatsapp/inbound.ts — normaliza o payload de inbound pra um shape único. PURO.
 *
 * Aceita (1) o webhook do Evolution (`messages.upsert`) direto, (2) o bridge fino do
 * agent-gateway / o webhook do disparos (ChipFlow) no formato genérico
 * `{ phone|from|number, text|message|body, messageId|id }`. Ignora o que a própria instância
 * enviou (`fromMe`), grupos e eventos que não são mensagem.
 */
import { phoneFromJid, toE164 } from "./phone";

export type InboundMsg = { phone: string; text: string; messageId?: string };

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function phoneOf(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return s.includes("@") ? phoneFromJid(s) : toE164(s);
}

export function normalizeInbound(payload: unknown): InboundMsg | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as any;

  // (1) Evolution API — messages.upsert
  if (typeof p.event === "string" || (p.data && p.data.key)) {
    const ev = String(p.event ?? "messages.upsert").toLowerCase().replace(/_/g, ".");
    if (ev !== "messages.upsert") return null;
    const d = p.data ?? {};
    const key = d.key ?? {};
    if (key.fromMe) return null;
    const phone = phoneOf(key.remoteJid);
    const m = d.message ?? {};
    const text = str(m.conversation) ?? str(m.extendedTextMessage?.text) ?? str(m.imageMessage?.caption) ?? str(d.text);
    if (!phone || !text) return null;
    return { phone, text, messageId: str(key.id) };
  }

  // (2) genérico (bridge / disparos)
  const phone = phoneOf(p.phone) ?? phoneOf(p.from) ?? phoneOf(p.number) ?? phoneOf(p.jid);
  const text = str(p.text) ?? str(p.message) ?? str(p.body);
  if (!phone || !text) return null;
  return { phone, text, messageId: str(p.messageId) ?? str(p.id) };
}
