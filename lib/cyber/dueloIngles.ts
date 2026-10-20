/**
 * O DUELO DE LINGUAGEM da Examiner (PURO, sem rede): a guardiã do braço esquerdo do Templo Cósmico (docs/superpowers/
 * specs/2026-10-20-templo-cosmico-design.md). Quem chega no topo da escadaria-veia é parado por ela — os olhos brilham
 * vermelho — e ela pergunta: "Você acha que consegue quebrar a barreira de saber apenas 1 idioma?". São 7 perguntas
 * de inglês de múltipla escolha (do agente de inglês, na hora; se a IA falhar, do banco fixo daqui), em nível crescente.
 * Passa quem acerta `NOTA_MINIMA`: a porta da cúpula abre pra sempre (User.cyberPerfil `examinerInglesEm`). Quem não
 * passa vê o erro medido (igual ao Relicário: a tela vermelha e o que faltou) e tenta de novo depois de `ESPERA_S`.
 * A correção é SEMPRE no servidor: o cliente só recebe as perguntas e as opções, nunca o gabarito antes de responder.
 */

export const TOTAL_PERGUNTAS = 7;
export const NOTA_MINIMA = 6;
/** quanto esperar (s) pra tentar de novo depois de perder */
export const ESPERA_S = 120;
/** o que ela diz quando alguém chega (a cutscene) */
export const FALA_DESAFIO = "Você acha que consegue quebrar a barreira de saber apenas 1 idioma?";

export type Nivel = 1 | 2 | 3;
/** uma pergunta com o gabarito (fica no servidor) */
export type Pergunta = { enunciado: string; opcoes: string[]; certa: number; nivel: Nivel; explica?: string };
/** o que vai pro cliente (sem o gabarito) */
export type PerguntaPublica = { i: number; enunciado: string; opcoes: string[]; nivel: Nivel };
export const publica = (p: Pergunta, i: number): PerguntaPublica => ({ i, enunciado: p.enunciado, opcoes: [...p.opcoes], nivel: p.nivel });

/** o BANCO FIXO (quando o agente de inglês não responde): 3 níveis — básico, intermediário, avançado */
export const BANCO: readonly Pergunta[] = [
  { nivel: 1, enunciado: "Choose the correct option: \"She ___ to school every day.\"", opcoes: ["go", "goes", "going", "gone"], certa: 1, explica: "Third person singular in the simple present takes -s: she goes." },
  { nivel: 1, enunciado: "What is the past tense of \"buy\"?", opcoes: ["buyed", "bought", "brought", "buys"], certa: 1, explica: "Buy → bought (irregular). \"Brought\" is the past of \"bring\"." },
  { nivel: 1, enunciado: "\"I am hungry.\" means:", opcoes: ["Estou com sede.", "Estou com fome.", "Estou com frio.", "Estou cansado."], certa: 1 },
  { nivel: 1, enunciado: "Choose the correct option: \"There ___ two books on the table.\"", opcoes: ["is", "are", "be", "has"], certa: 1 },
  { nivel: 1, enunciado: "Which word is the opposite of \"cheap\"?", opcoes: ["easy", "expensive", "early", "empty"], certa: 1 },
  { nivel: 1, enunciado: "Complete: \"___ you like coffee?\"", opcoes: ["Does", "Are", "Do", "Is"], certa: 2 },
  { nivel: 1, enunciado: "\"Library\" in Portuguese is:", opcoes: ["livraria", "biblioteca", "liberdade", "laboratório"], certa: 1, explica: "False friend: library = biblioteca; bookstore = livraria." },
  { nivel: 1, enunciado: "Choose the correct plural of \"child\":", opcoes: ["childs", "childes", "children", "childrens"], certa: 2 },
  { nivel: 2, enunciado: "Choose the correct option: \"I have lived here ___ 2019.\"", opcoes: ["for", "since", "during", "from"], certa: 1, explica: "Since + a point in time; for + a period." },
  { nivel: 2, enunciado: "\"Actually\" means:", opcoes: ["atualmente", "na verdade", "ativamente", "imediatamente"], certa: 1, explica: "False friend: actually = na verdade; currently = atualmente." },
  { nivel: 2, enunciado: "Complete: \"If it rains tomorrow, we ___ at home.\"", opcoes: ["stay", "will stay", "would stay", "stayed"], certa: 1, explica: "First conditional: if + present, will + verb." },
  { nivel: 2, enunciado: "Choose the correct option: \"He is the ___ student in the class.\"", opcoes: ["most smart", "smarter", "smartest", "more smartest"], certa: 2 },
  { nivel: 2, enunciado: "What does \"to look forward to\" mean?", opcoes: ["olhar para frente", "estar ansioso por (algo bom)", "procurar", "cuidar de"], certa: 1 },
  { nivel: 2, enunciado: "Complete: \"She asked me where ___.\"", opcoes: ["do I live", "I lived", "did I live", "I do live"], certa: 1, explica: "Indirect questions keep statement word order." },
  { nivel: 2, enunciado: "Choose the correct option: \"I'm not used to ___ up so early.\"", opcoes: ["wake", "waking", "woke", "be waking"], certa: 1, explica: "Be used to + -ing." },
  { nivel: 2, enunciado: "\"Pretend\" means:", opcoes: ["pretender", "fingir", "prender", "pertencer"], certa: 1 },
  { nivel: 2, enunciado: "Which sentence is correct?", opcoes: ["I didn't went there.", "I didn't go there.", "I don't went there.", "I not go there."], certa: 1 },
  { nivel: 3, enunciado: "Complete: \"If I ___ known, I would have told you.\"", opcoes: ["have", "had", "would have", "has"], certa: 1, explica: "Third conditional: if + past perfect, would have + participle." },
  { nivel: 3, enunciado: "Choose the best option: \"Hardly ___ the door when the phone rang.\"", opcoes: ["I had opened", "had I opened", "I opened", "did I opened"], certa: 1, explica: "Negative adverbials at the start trigger inversion." },
  { nivel: 3, enunciado: "\"To beat around the bush\" means:", opcoes: ["bater no mato", "enrolar, não ir direto ao ponto", "vencer com facilidade", "trabalhar ao ar livre"], certa: 1 },
  { nivel: 3, enunciado: "Choose the correct option: \"The report needs ___ before Friday.\"", opcoes: ["to finish", "finishing", "finish", "finished"], certa: 1, explica: "Need + -ing has a passive meaning (= needs to be finished)." },
  { nivel: 3, enunciado: "Which word best completes: \"Her argument was so ___ that nobody could refute it.\"", opcoes: ["compelling", "compelled", "compulsive", "competing"], certa: 0 },
  { nivel: 3, enunciado: "Complete: \"I wish I ___ more time to study yesterday.\"", opcoes: ["have", "had had", "would have", "had"], certa: 1 },
  { nivel: 3, enunciado: "\"Eventually\" means:", opcoes: ["eventualmente", "finalmente, com o tempo", "às vezes", "imediatamente"], certa: 1, explica: "False friend: eventually = finalmente; occasionally = eventualmente." },
  { nivel: 3, enunciado: "Choose the correct option: \"Not only ___ late, but he also forgot the tickets.\"", opcoes: ["he arrived", "did he arrive", "he did arrive", "arrived he"], certa: 1 },
];

function rng(semente: number) { let a = semente >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** embaralha as opções de uma pergunta (a certa acompanha) */
export function embaralharOpcoes(p: Pergunta, r: () => number): Pergunta {
  const idx = p.opcoes.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j]!, idx[i]!]; }
  return { ...p, opcoes: idx.map((i) => p.opcoes[i]!), certa: idx.indexOf(p.certa) };
}
/** sorteia as 7 do banco em nível crescente (2 básicas, 3 intermediárias, 2 avançadas), opções embaralhadas */
export function sortearDoBanco(semente: number): Pergunta[] {
  const r = rng(semente), de = (n: Nivel, k: number) => { const l = BANCO.filter((p) => p.nivel === n).slice(); for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [l[i], l[j]] = [l[j]!, l[i]!]; } return l.slice(0, k); };
  return [...de(1, 2), ...de(2, 3), ...de(3, 2)].map((p) => embaralharOpcoes(p, r));
}

/** valida o que veio do agente de inglês (JSON): 7 perguntas, 4 opções distintas, a certa no intervalo — senão, null */
export function validarPerguntasDaIA(raw: unknown): Pergunta[] | null {
  const lista = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { perguntas?: unknown }).perguntas) ? (raw as { perguntas: unknown[] }).perguntas : null;
  if (!lista || lista.length < TOTAL_PERGUNTAS) return null;
  const out: Pergunta[] = [];
  for (const it of lista.slice(0, TOTAL_PERGUNTAS)) {
    if (!it || typeof it !== "object") return null;
    const o = it as Record<string, unknown>, enunciado = typeof o.enunciado === "string" ? o.enunciado.trim().slice(0, 300) : "";
    const opcoes = Array.isArray(o.opcoes) ? o.opcoes.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 120)) : [];
    const certa = typeof o.certa === "number" && Number.isInteger(o.certa) ? o.certa : -1, nivel = o.nivel === 1 || o.nivel === 2 || o.nivel === 3 ? o.nivel : 2;
    if (!enunciado || opcoes.length !== 4 || new Set(opcoes.map((x) => x.toLowerCase())).size !== 4 || opcoes.some((x) => !x) || certa < 0 || certa > 3) return null;
    out.push({ enunciado, opcoes, certa, nivel, ...(typeof o.explica === "string" ? { explica: o.explica.trim().slice(0, 240) } : {}) });
  }
  return out;
}

export type Resultado = { acertos: number; total: number; passou: boolean; /** o erro medido: cada pergunta errada, a resposta dada, a certa e por quê */ erros: { i: number; enunciado: string; deu: string | null; certa: string; explica?: string }[] };
/** corrige as respostas (índice da opção por pergunta; null = não respondeu) */
export function corrigir(perguntas: readonly Pergunta[], respostas: readonly (number | null)[]): Resultado {
  let acertos = 0; const erros: Resultado["erros"] = [];
  perguntas.forEach((p, i) => {
    const r = respostas[i];
    if (r === p.certa) { acertos++; return; }
    erros.push({ i, enunciado: p.enunciado, deu: typeof r === "number" && r >= 0 && r < p.opcoes.length ? p.opcoes[r]! : null, certa: p.opcoes[p.certa]!, ...(p.explica ? { explica: p.explica } : {}) });
  });
  return { acertos, total: perguntas.length, passou: acertos >= NOTA_MINIMA, erros };
}
/** as respostas que vieram do cliente, saneadas (7 posições; inválida = null) */
export function sanearRespostas(raw: unknown): (number | null)[] {
  const l = Array.isArray(raw) ? raw : [];
  return Array.from({ length: TOTAL_PERGUNTAS }, (_, i) => { const v = l[i]; return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 3 ? v : null; });
}
/** pode tentar de novo agora? (`perdeuEm` = quando perdeu, ms) */
export const podeTentar = (perdeuEm: number | null | undefined, agoraMs: number) => !perdeuEm || agoraMs - perdeuEm >= ESPERA_S * 1000;

/** o pedido pro agente de inglês (o modelo de texto): 7 perguntas em JSON, crescentes, focadas em brasileiros */
export const PROMPT_AGENTE_INGLES = `You are the English examiner of a futuristic temple. Create exactly ${TOTAL_PERGUNTAS} multiple-choice English questions for a Brazilian Portuguese speaker, in increasing difficulty: 2 basic (nivel 1), 3 intermediate (nivel 2), 2 advanced (nivel 3). Mix grammar, vocabulary, false friends (falsos cognatos) and idioms. Each question has exactly 4 distinct options and one correct answer. The prompt ("enunciado") is in English; options may be English or Portuguese translations. Add a one-sentence explanation in English ("explica").
Answer ONLY with JSON: {"perguntas":[{"enunciado":"...","opcoes":["a","b","c","d"],"certa":0,"nivel":1,"explica":"..."}]}`;
