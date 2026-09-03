/**
 * lib/agent/structured-client.ts — parser CLIENT-SAFE da sentinela @@STRUCTURED@@ com
 * FALLBACK PRA TEXTO. Módulo puro (sem React/rede) → testável; usado por StudyCoworkChat
 * e ResearchChat. Deve bater com STRUCTURED_SENTINEL de app/api/ai/chat/route.ts.
 *
 * Contrato: payload válido → { kind:"answer", answer }. Payload MALFORMADO (JSON cortado
 * por queda de rede, stream truncado, lixo) → NUNCA "sem resposta": degrada pra texto na
 * melhor ordem possível:
 *   1. o `nucleo` extraído por regex do JSON quebrado (o que o modelo quis dizer);
 *   2. o texto que veio ANTES da sentinela (se houver);
 *   3. o payload "despido" de pontuação JSON (últimos recurso legível);
 *   4. a mensagem padrão de vazio.
 */
import type { StructuredAnswer } from "@/lib/agent/contracts";

export const STRUCTURED_SENTINEL = "@@STRUCTURED@@";
export const EMPTY_FALLBACK = "Sem resposta agora.";

export type StructuredParse =
  | { kind: "answer"; answer: StructuredAnswer }
  | { kind: "text"; text: string };

/** Decodifica o conteúdo de uma string JSON já capturada (sem as aspas externas). */
function unescapeJsonString(s: string): string {
  try { return JSON.parse(`"${s}"`); } catch { return s.replace(/\\n/g, "\n").replace(/\\"/g, '"'); }
}

/** Fallback texto a partir de um payload quebrado + o que veio antes da sentinela. */
export function fallbackTextFrom(raw: string, before: string): string {
  const m = /"nucleo"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(raw); // aceita string cortada no meio
  const nucleo = m ? unescapeJsonString(m[1]).trim() : "";
  if (nucleo) return nucleo;
  const pre = (before || "").trim();
  if (pre) return pre;
  const stripped = raw.replace(/[{}[\]"]/g, " ").replace(/\s+/g, " ").trim();
  return stripped.length >= 8 ? stripped.slice(0, 600) : EMPTY_FALLBACK;
}

/**
 * Procura a sentinela no acumulado do stream. null = não é resposta estruturada (deixa o
 * chamador tratar studio/research/texto). Nunca lança.
 */
export function parseStructuredStream(acc: string): StructuredParse | null {
  const i = acc.indexOf(STRUCTURED_SENTINEL);
  if (i < 0) return null;
  const raw = acc.slice(i + STRUCTURED_SENTINEL.length);
  const before = acc.slice(0, i);
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && typeof obj.nucleo === "string" && obj.nucleo.trim()) {
      return { kind: "answer", answer: obj as StructuredAnswer };
    }
  } catch { /* malformado → fallback */ }
  return { kind: "text", text: fallbackTextFrom(raw, before) };
}
