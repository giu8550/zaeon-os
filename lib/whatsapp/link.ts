/**
 * lib/whatsapp/link.ts — o onboarding por QR `wa.me` (o jeito NÃO invasivo). PURO.
 *
 * O aluno escaneia um QR que abre o WhatsApp já no chat da PLATAFORMA com o texto
 * `CONECTAR-<código>`; ao enviar, o inbound mapeia telefone ↔ userId e marca opt-in.
 * Nunca linkamos a conta do aluno (sem QR Baileys por usuário). "PARE" desliga; "VOLTAR" religa.
 */
import { jidNumber } from "./phone";

// sem 0/O/1/I (ambíguos em tela/áudio)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export function newVerifyCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export const connectText = (code: string): string => `CONECTAR-${code}`;

/** URL wa.me com o texto pré-preenchido (vira QR na UI). */
export function waMeUrl(platformPhone: string, text: string): string {
  return `https://wa.me/${jidNumber(platformPhone)}?text=${encodeURIComponent(text)}`;
}

export type InboundIntent =
  | { kind: "connect"; code: string }
  | { kind: "stop" }
  | { kind: "resume" }
  | { kind: "chat"; text: string };

const CONNECT_RE = /conectar\s*-?\s*([a-z0-9]{6})\b/i;
const STOP_RE = /^\s*(pare|parar|stop|sair|cancelar)\s*[.!]*\s*$/i;
const RESUME_RE = /^\s*(voltar|continuar|retomar|start)\s*[.!]*\s*$/i;

/** Classifica a mensagem recebida. Comandos são a mensagem INTEIRA (senão é conversa). */
export function parseInbound(raw: string | null | undefined): InboundIntent {
  const text = (raw ?? "").trim();
  const m = CONNECT_RE.exec(text);
  if (m) return { kind: "connect", code: m[1].toUpperCase() };
  if (STOP_RE.test(text)) return { kind: "stop" };
  if (RESUME_RE.test(text)) return { kind: "resume" };
  return { kind: "chat", text };
}
