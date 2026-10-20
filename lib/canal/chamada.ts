/**
 * lib/canal/chamada.ts — chamar uma agente pelo NOME, sem @ (#466). PURO.
 *
 * O caso real: "sim continue aura pode ir em frente" foi respondida pelo Téo (a agente da vez), porque só o @
 * chamava alguém. Agora o nome escrito também chama — mas só quando é usado PRA CHAMAR (vocativo), porque
 * "aura" é palavra comum ("minha aura está pesada") e Caio/Davi podem ser nomes de pessoas da conversa:
 *   - nome seguido de vírgula, "!" ou ":"            → "aura, me explica"
 *   - nome no fim, depois de vírgula                  → "me explica isso, aura"
 *   - nome colado num pedido/saudação (antes ou depois) → "continue aura", "aura me ajuda", "oi aura"
 * Nunca conta: nome depois de artigo/possessivo/preposição ("a aura do lugar", "sua aura", "sobre aura"), nem
 * nome que é o de uma PESSOA da conversa (aí é com a pessoa que se fala).
 */

export type AgenteChamavel = { agentKey: string; nome: string };

const semAcento = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Palavras de pedido/saudação que, coladas no nome, fazem dele um chamado. */
const PEDIDO = new Set([
  "continue", "continua", "pode", "podes", "responde", "responda", "explica", "explique", "me", "fala", "fale",
  "diga", "diz", "conta", "conte", "segue", "siga", "ajuda", "ajude", "vem", "venha", "volta", "volte",
  "oi", "ei", "ola", "opa", "ai", "bom", "dia", "tarde", "noite", "obrigado", "obrigada", "valeu", "vlw",
]);
/** Antes do nome, estas palavras fazem dele uma coisa, não um chamado ("a aura", "minha aura", "sobre aura"). */
const COISA = new Set([
  "a", "o", "as", "os", "uma", "um", "da", "do", "das", "dos", "de", "na", "no", "em", "sua", "seu", "minha", "meu",
  "tua", "teu", "nossa", "nosso", "essa", "esse", "esta", "este", "aquela", "aquele", "sobre", "com", "sem", "pra",
  "para", "pela", "pelo", "que", "qual",
]);

type Tok = { w: string; antes: string; depois: string };

/** Palavras (sem acento, minúsculas) com a pontuação que vem antes e depois de cada uma. */
function palavras(texto: string): Tok[] {
  const out: Tok[] = [];
  const re = /([^\p{L}\p{N}@]*)([\p{L}\p{N}@][\p{L}\p{N}._-]*)/gu;
  let m: RegExpExecArray | null;
  const t = semAcento(texto);
  while ((m = re.exec(t))) {
    if (out.length) out[out.length - 1]!.depois = m[1] ?? "";
    out.push({ w: m[2]!, antes: m[1] ?? "", depois: "" });
  }
  if (out.length) out[out.length - 1]!.depois = t.slice(t.lastIndexOf(out[out.length - 1]!.w) + out[out.length - 1]!.w.length);
  return out;
}

/**
 * As agentes chamadas pelo NOME nesta mensagem (sem @). `pessoas` = primeiros nomes das pessoas do canal (quem
 * tem o mesmo nome de uma agente não conta como chamar a agente). Mensagem com @ não passa por aqui (o @ manda).
 */
export function chamadasPeloNome(texto: string, agentes: readonly AgenteChamavel[], pessoas: readonly string[] = []): string[] {
  const toks = palavras(texto);
  const humanos = new Set(pessoas.map((p) => semAcento(p).split(/\s+/)[0]).filter(Boolean));
  const chamadas = new Set<string>();
  toks.forEach((t, i) => {
    if (t.w.startsWith("@")) return;
    const ag = agentes.find((a) => [a.agentKey, a.nome, a.nome.split(/\s+/)[0] ?? ""].map(semAcento).some((n) => n && n === t.w));
    if (!ag || humanos.has(t.w)) return;
    const ant = toks[i - 1], prox = toks[i + 1];
    if (ant && COISA.has(ant.w) && !/[,!:]/.test(t.antes)) return;          // "a aura", "minha aura", "sobre aura"
    const vocativo =
      /^\s*[,!:]/.test(t.depois) ||                                        // "aura, me explica"
      (!prox && /,/.test(t.antes)) ||                                       // "me explica isso, aura"
      (ant !== undefined && PEDIDO.has(ant.w) && !/[.?]/.test(t.antes)) ||  // "continue aura", "oi aura"
      (prox !== undefined && PEDIDO.has(prox.w) && !/[.?]/.test(t.depois)); // "aura me ajuda", "aura pode ir"
    if (vocativo) chamadas.add(ag.agentKey);
  });
  return agentes.map((a) => a.agentKey).filter((k) => chamadas.has(k));
}
