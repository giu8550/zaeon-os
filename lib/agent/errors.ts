/**
 * lib/agent/errors.ts — taxonomia de ERROS do harness (o que os repos de harness-engineering
 * tratam como cidadão de 1ª classe: falha tipada + degradação graciosa). Cobre TODOS os pontos
 * onde algo pode dar errado: abrir/rodar tool, chamar o modelo, orçamento, rede, output vazio,
 * memória fora do ar. Cada código carrega: se é RETRYABLE (vale tentar de novo) e se é FATAL
 * (impede a resposta) — e uma MENSAGEM PT-BR na voz do produto (curta, sem "Erro:", sem culpa).
 *
 * Fonte-da-verdade para o executor: NÃO invente mensagens de erro — use `messageForError`.
 */

export type AuraErrorCode =
  // — abrir/rodar tools —
  | "tool_denied"          // permit() = DENY (plano insuficiente ou GPU ausente)
  | "tool_unapproved"      // REQUIRE_APPROVAL recusado no modo guiado (o usuário disse não)
  | "tool_unknown"         // tool não registrada no runtime
  | "tool_timeout"         // withTimeout estourou
  | "tool_failed"          // run() da tool lançou / retornou ok:false
  // — chamar o modelo (Gemini) —
  | "model_failed"         // a chamada ao modelo falhou
  | "model_invalid_json"   // geminiJson não parseou o JSON esperado
  // — controle do laço —
  | "budget_exceeded"      // estourou orçamento de tokens/tempo (stop "orcamento")
  | "max_iter"             // atingiu o teto de revisões (stop "maxIter")
  | "loop_detected"        // repetição detectada (stop "loop")
  // — bordas —
  | "rate_limited"         // 429 do guard/ratelimit
  | "aborted"              // o usuário parou (⏹ / AbortController)
  | "network"              // falha de rede no fetch
  | "no_output"            // stream terminou vazio
  | "memory_unavailable"   // L3 (Atlas/embedding) fora do ar — DEGRADA, não bloqueia
  | "unknown";

export type AuraError = { code: AuraErrorCode; detail?: string; retryable: boolean; fatal: boolean };

const RETRYABLE = new Set<AuraErrorCode>([
  "tool_timeout", "tool_failed", "model_failed", "model_invalid_json",
  "rate_limited", "network", "no_output", "unknown",
]);
// FATAL = a resposta do turno não sai (precisa avisar). Os demais DEGRADAM (o laço segue
// com evidência parcial / fallback e ainda entrega algo).
const FATAL = new Set<AuraErrorCode>(["network", "no_output", "model_failed", "aborted", "unknown"]);

export function auraError(code: AuraErrorCode, detail?: string): AuraError {
  return { code, detail, retryable: RETRYABLE.has(code), fatal: FATAL.has(code) };
}

/** Deriva o código a partir de um erro cru (ex.: catch do fetch/timeout). */
export function codeFromThrown(e: unknown): AuraErrorCode {
  const name = (e as any)?.name;
  const msg = String((e as any)?.message ?? e ?? "").toLowerCase();
  if (name === "AbortError") return "aborted";
  if (msg.includes("timeout")) return "tool_timeout";
  if (msg.includes("429") || msg.includes("rate")) return "rate_limited";
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("econn")) return "network";
  return "unknown";
}

// Mensagens PT-BR — voz do produto: curtas, sem "Erro:", sem "eu não consegui", com saída.
const MESSAGES: Record<AuraErrorCode, string> = {
  tool_denied: "Esse recurso não está no seu plano ainda.",
  tool_unapproved: "Ok, não fiz essa ação.",
  tool_unknown: "Essa ação não está disponível aqui.",
  tool_timeout: "A geração demorou demais e eu parei. Quer tentar de novo?",
  tool_failed: "Não consegui concluir essa parte. Tenta de novo em instantes.",
  model_failed: "Tive um tropeço pra pensar agora. Tenta de novo?",
  model_invalid_json: "Me embolei ao organizar a resposta. Tenta de novo?",
  budget_exceeded: "Entreguei o melhor até aqui — o assunto era grande. Quer que eu continue?",
  max_iter: "Revisei o quanto dava; segue o melhor resultado.",
  loop_detected: "Acabei me repetindo. Reformula o pedido que eu tento de novo?",
  rate_limited: "Muitos pedidos em pouco tempo. Espera uns segundos e tenta de novo.",
  aborted: "⏹ Parado.",
  network: "Falha de conexão. Tenta de novo?",
  no_output: "Não veio resposta. Tenta reformular o pedido?",
  memory_unavailable: "",   // silencioso: memória fora do ar só DEGRADA (sem aviso ao usuário)
  unknown: "Algo saiu do esperado. Tenta de novo?",
};

export function messageForError(e: AuraError | AuraErrorCode): string {
  const code = typeof e === "string" ? e : e.code;
  return MESSAGES[code] ?? MESSAGES.unknown;
}

/** Stop reason do runTrajectory → código de erro (quando o stop NÃO é "aprovado"). */
export function codeFromStop(stop?: string): AuraErrorCode | null {
  switch (stop) {
    case "orcamento": return "budget_exceeded";
    case "maxIter": return "max_iter";
    case "loop": return "loop_detected";
    case "erro": return "unknown";
    default: return null;   // "aprovado" ou undefined = sem erro
  }
}
