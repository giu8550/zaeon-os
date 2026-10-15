/**
 * lib/canal/estadoAgente.ts — O QUE o agente está fazendo, em palavras (PURO e isomórfico).
 *
 * Antes o escritório só dizia "está escrevendo…". Agora o servidor publica o estado no mesmo
 * evento de "digitando" (campo `estado`) e a tela mostra o rótulo ("Nina está pesquisando…").
 *
 * Os estados que o harness JÁ revela hoje vêm das fases dele (`Phase` em lib/agent/trajectory):
 *   route→entendendo · plan→planejando · gather→pesquisando · reason/critique→investigando
 *   draft/finalize→redigindo.
 * `descanso` = chegou ao teto de uso. `consultando` e `ferramenta` já têm rótulo, mas o harness
 * ainda não os emite (chamar outro agente é o item B do #396) — não são inventados aqui.
 */
export const ESTADOS = [
  "ocioso", "digitando", "entendendo", "planejando", "pesquisando", "investigando", "redigindo",
  "consultando", "ferramenta", "descanso",
] as const;
export type EstadoAgente = (typeof ESTADOS)[number];

const SET = new Set<string>(ESTADOS);

/** Valor vindo do fio → estado conhecido. Qualquer coisa desconhecida vira "digitando" (nunca quebra a tela). */
export function normalizarEstado(v: unknown): EstadoAgente {
  return typeof v === "string" && SET.has(v) ? (v as EstadoAgente) : "digitando";
}

/** Fase do harness (o `detail` do AgentStep) → estado. Fase desconhecida/vazia → "digitando". */
export function estadoDeFase(fase: unknown): EstadoAgente {
  switch (typeof fase === "string" ? fase.trim() : "") {
    case "route": return "entendendo";
    case "plan": return "planejando";
    case "gather": return "pesquisando";
    case "reason":
    case "critique": return "investigando";
    case "draft":
    case "finalize": return "redigindo";
    default: return "digitando";
  }
}

/** O agente está "no ar" (a tela mostra o indicador animado)? `ocioso` e `descanso` não. */
export const estaAtivo = (e: EstadoAgente): boolean => e !== "ocioso" && e !== "descanso";

const FRASE: Record<EstadoAgente, string> = {
  ocioso: "",
  digitando: "está escrevendo",
  entendendo: "está entendendo o pedido",
  planejando: "está planejando a resposta",
  pesquisando: "está pesquisando",
  investigando: "está investigando",
  redigindo: "está redigindo",
  consultando: "está consultando outro agente",
  ferramenta: "está usando uma ferramenta",
  descanso: "está em descanso (chegou ao limite de uso)",
};

/** "Nina está pesquisando…" — o nome fica fora da frase pra o chamador estilizar. */
export function frase(estado: EstadoAgente): string {
  return FRASE[estado];
}

/** Rótulo completo, em texto puro (title/aria-label). */
export function rotulo(nome: string, estado: EstadoAgente): string {
  const f = FRASE[estado];
  return f ? `${nome} ${f}` : nome;
}
