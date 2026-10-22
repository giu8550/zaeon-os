/**
 * lib/chat/feedbackDataset.ts — o 👍/👎 das respostas da Aura vira dado de QUALIDADE, anonimizado. PURO.
 *
 * Caminho: o chat manda o voto (POST /api/chat/feedback) → ChatFeedback no Mongo (sem userId: só um hash salgado,
 * pra desfazer/trocar o voto) → a exportação (lib/hf/exportarFeedback) sobe os novos em JSONL pro dataset privado
 * do Hugging Face (HF_DATASETS_ORG/zaeon-feedback-chat).
 *
 * Anonimização (decisão do dono, 2026-10-22: "sem nome nem e-mail"): nenhum id/nome/e-mail do aluno sai daqui, e o
 * TEXTO passa por `anonimizar` — e-mail, telefone, CPF/CNPJ, links com parâmetros e sequências longas de dígitos
 * viram marcadores. Nome próprio no meio da frase não dá pra pegar com regex: o dataset é privado da org por isso.
 */
import { createHash } from "node:crypto";

export type Voto = "up" | "down";

/** Tetos: pergunta/resposta longas não servem pra avaliar e pesam no dataset. */
export const MAX_PERGUNTA = 4_000;
export const MAX_RESPOSTA = 12_000;

const REGRAS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]"],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[cnpj]"],   // antes do CPF: 11 dos 14 dígitos casariam como CPF
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf]"],
  [/https?:\/\/\S+\?\S+/g, "[link]"],          // URL com query costuma levar token/id
  [/\b\d{9,}\b/g, "[numero]"],                // antes do telefone: senão o fim de um protocolo vira "[telefone]"
  [/(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, "[telefone]"],
];

export function anonimizar(texto: string): string {
  let t = String(texto ?? "");
  for (const [re, marca] of REGRAS) t = t.replace(re, marca);
  return t;
}

/** Hash salgado do usuário: dá pra desfazer o voto dele, não dá pra saber quem é. */
export function hashUsuario(userId: string, sal: string): string {
  return createHash("sha256").update(`${sal}:${userId}`).digest("hex").slice(0, 24);
}

export type EntradaVoto = { msgId: string; voto: Voto | null; pergunta?: string; resposta?: string; modelo?: string; sala?: string };

/** Valida e limpa o corpo do POST. null = inválido. */
export function lerEntrada(body: unknown): EntradaVoto | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const msgId = typeof b.msgId === "string" ? b.msgId.trim().slice(0, 80) : "";
  const voto = b.voto === "up" || b.voto === "down" ? b.voto : b.voto === null ? null : undefined;
  if (!msgId || voto === undefined) return null;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  return {
    msgId, voto,
    pergunta: str(b.pergunta, MAX_PERGUNTA),
    resposta: str(b.resposta, MAX_RESPOSTA),
    modelo: str(b.modelo, 80),
    sala: b.sala === "pesquisa" ? "pesquisa" : "estudos",
  };
}

/** Uma linha do dataset (JSONL). Só o que serve pra medir qualidade. */
export type LinhaDataset = { id: string; data: string; voto: Voto; sala: string; modelo: string | null; pergunta: string; resposta: string };

export function linhaDoDataset(r: { id: string; criadoEm: Date; voto: string; sala: string; modelo: string | null; pergunta: string; resposta: string }): LinhaDataset {
  return { id: r.id, data: r.criadoEm.toISOString(), voto: r.voto as Voto, sala: r.sala, modelo: r.modelo, pergunta: r.pergunta, resposta: r.resposta };
}
