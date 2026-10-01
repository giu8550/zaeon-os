/**
 * lib/canal/mention.ts — parser de `@mention` do canal (PURO).
 *
 * O padrão vem do Buzz: `@nome` na mensagem convoca o agente. Aqui `@aura`, `@medicina`
 * (agentKey) e também `@Osler` / `@Aura` (nome de exibição) funcionam — tudo resolvido por
 * um mapa de aliases que o chamador monta a partir do roster (lib/agents/roster.ts).
 * `@desconhecido` é ignorado em silêncio: o parser nunca inventa agente.
 */

/** `@token` precedido de início/espaço/pontuação; token = letras/dígitos/_/- (acentos ok). */
const MENTION_RE = /(^|[\s(\[{,;:!?"'])@([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;

/** Normaliza um alias pra comparação: minúsculo, sem acento, sem espaços. */
export function normalizarAlias(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

/**
 * Monta o mapa alias→agentKey a partir de uma lista de agentes (key + nome).
 * Inclui a própria key e o nome normalizado ("Téo" → "teo"). Em colisão a 1ª ganha.
 */
export function montarAliases(agentes: { agentKey: string; nome: string }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of agentes) {
    for (const alias of [a.agentKey, a.nome]) {
      const n = normalizarAlias(alias);
      if (n && !m.has(n)) m.set(n, a.agentKey);
    }
  }
  return m;
}

/** Extrai os agentKeys mencionados (únicos, na ordem em que aparecem). */
export function parseMentions(texto: string, aliases: Map<string, string>): string[] {
  const out: string[] = [];
  if (!texto) return out;
  for (const m of texto.matchAll(MENTION_RE)) {
    const key = aliases.get(normalizarAlias(m[2]!));
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

/** Remove os `@tokens` conhecidos do texto (vira o OBJETIVO do turno do agente). */
export function semMencoes(texto: string, aliases: Map<string, string>): string {
  return (texto || "")
    .replace(MENTION_RE, (full, pre: string, tok: string) => (aliases.has(normalizarAlias(tok)) ? pre : full))
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Sugestões de autocomplete: agentes cujo key/nome começa com o prefixo digitado após `@`. */
export function sugerir<T extends { agentKey: string; nome: string }>(prefixo: string, agentes: T[], max = 6): T[] {
  const p = normalizarAlias(prefixo);
  const hit = agentes.filter((a) => !p || normalizarAlias(a.agentKey).startsWith(p) || normalizarAlias(a.nome).startsWith(p));
  return hit.slice(0, max);
}

/** Prefixo sendo digitado após o último `@` (null se não há @ aberto no fim do texto). */
export function mencaoAberta(texto: string, caret?: number): { inicio: number; prefixo: string } | null {
  const upto = texto.slice(0, caret ?? texto.length);
  const m = /(^|[\s(\[{,;:!?"'])@([\p{L}\p{N}_-]*)$/u.exec(upto);
  if (!m) return null;
  return { inicio: upto.length - m[2]!.length - 1, prefixo: m[2]! };
}
