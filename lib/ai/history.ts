/**
 * sanitizeHistory — normaliza o histórico de conversa que o front manda para o
 * formato que o Vertex/Gemini exige no startChat({ history }).
 *
 * O Gemini NÃO guarda contexto sozinho: a cada turno o cliente reenvia o histórico
 * e a gente injeta aqui. Regras do Vertex: itens {role:'user'|'model', parts:[{text}]},
 * sem textos vazios, começando OBRIGATORIAMENTE por 'user', papéis alternados.
 */
export type ChatTurn = { role: "user" | "model"; parts: { text: string }[] };

export function sanitizeHistory(raw: any, maxTurns = 20): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: ChatTurn[] = raw
    .map((m: any): ChatTurn => {
      const role = m?.role === "model" ? "model" : "user";
      const text =
        typeof m?.parts?.[0]?.text === "string"
          ? m.parts[0].text
          : typeof m?.text === "string"
            ? m.text
            : "";
      return { role, parts: [{ text: String(text).trim() }] };
    })
    .filter((m) => m.parts[0].text.length > 0);

  // Vertex exige começar em 'user' → remove turnos 'model' iniciais (ex.: saudação).
  while (cleaned.length && cleaned[0].role !== "user") cleaned.shift();

  // Colapsa papéis repetidos seguidos (mantém alternância previsível).
  const alt: ChatTurn[] = [];
  for (const m of cleaned) {
    const last = alt[alt.length - 1];
    if (last && last.role === m.role) last.parts[0].text += "\n" + m.parts[0].text;
    else alt.push(m);
  }

  return janelaEmBlocos(alt, maxTurns); // teto de turnos p/ controlar tokens
}

/**
 * O teto de turnos, mas com o INÍCIO andando em blocos (out/2026, cache implícito do Gemini): `slice(-max)` mudava o
 * começo do histórico a CADA turno — e o cache do Gemini só acerta com o começo do prompt idêntico (≥ 4.096 tokens).
 * Em blocos de `bloco` mensagens, o começo fica parado por ~5 trocas; a janela tem entre max−bloco+1 e max mensagens.
 * `bloco` par: o início continua numa mensagem do usuário (a alternância começa em 'user').
 */
export function janelaEmBlocos<T>(msgs: T[], max: number, bloco = 10): T[] {
  if (msgs.length <= max) return msgs;
  const inicio = Math.ceil((msgs.length - max) / bloco) * bloco;
  return msgs.slice(inicio);
}
