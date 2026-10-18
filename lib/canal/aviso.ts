/**
 * lib/canal/aviso.ts — o aviso de mensagem nova em TEMPO REAL sempre cabe no Pusher (#438). PURO e isomórfico.
 *
 * O Pusher recusa eventos com mais de 10 KB — e o servidor engolia o erro em silêncio. Foi o que fez a mensagem
 * do Martinez não chegar ao vivo: o aviso levava a FOTO INTEIRA dele (data:image… de 13 KB). Agora:
 *   1. foto guardada inteira (data:…) nunca vai no aviso — a tela pega a foto da lista de pessoas que já tem;
 *   2. se mesmo assim o aviso passar do limite (ex.: resposta muito longa de um agente), vai um aviso LEVE
 *      (`cortada: true`, sem o texto) e a tela busca a conversa de novo.
 */
import type { MensagemWire } from "./wire";

/** Limite do Pusher é 10 KB por evento; deixa folga pro envelope (nome do canal/evento). */
export const LIMITE_AVISO_BYTES = 9_000;

/** Tamanho em bytes (UTF-8) do JSON — o que o Pusher mede. */
export function bytesDoJson(v: unknown): number {
  const s = JSON.stringify(v) ?? "";
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } // par substituto (emoji) = 4 bytes
    else n += 3;
  }
  return n;
}

/** Foto guardada inteira no texto (base64)? Essa nunca vai no aviso. */
export const ehFotoInteira = (avatar: string | null | undefined): boolean => typeof avatar === "string" && avatar.startsWith("data:");

export type AvisoMensagem = MensagemWire & { cortada?: boolean };

/** O que vai pelo Pusher pra uma mensagem nova: sem foto inteira e sempre dentro do limite. */
export function avisoDaMensagem(m: MensagemWire, limite = LIMITE_AVISO_BYTES): AvisoMensagem {
  const leve: AvisoMensagem = ehFotoInteira(m.autorAvatar) ? { ...m, autorAvatar: null } : { ...m };
  if (bytesDoJson(leve) <= limite) return leve;
  // ainda grande (texto enorme): só o essencial — a tela busca a mensagem completa
  return {
    id: m.id, canalId: m.canalId, autorTipo: m.autorTipo, autorId: m.autorId, texto: "", mencoes: [],
    createdAt: m.createdAt, autorNome: m.autorNome ?? null, autorAvatar: null, cortada: true,
  };
}

/**
 * Na TELA: a mensagem chegou sem foto (porque a foto é guardada inteira) → usa a da lista de pessoas do canal
 * (que veio no carregamento normal, sem limite). Agente e quem já tem foto no aviso ficam como estão.
 */
export function comFotoDaLista<T extends { autorTipo: string; autorId: string; autorAvatar?: string | null }>(
  m: T, pessoas: readonly { id: string; avatar?: string | null }[],
): T {
  if (m.autorAvatar || m.autorTipo === "agente") return m;
  const p = pessoas.find((x) => x.id === m.autorId);
  return p?.avatar ? { ...m, autorAvatar: p.avatar } : m;
}
