/**
 * lib/agent/roteadorKnn.ts — o ROTEADOR POR SIMILARIDADE (out/2026, "as respostas estão lentas"): no lugar da chamada
 * ao modelo que só classifica a intenção (~2,7 s mesmo sem pensar; ~5 s antes), o vetor da pergunta — o MESMO que o
 * RAG da turma e o cache de respostas já calculam (lib/rag/embed embedPerguntaCompartilhado) — vota contra exemplos
 * rotulados de cada intenção. Padrão do aurelio-labs/semantic-router (MIT), código nosso. Confiante (similaridade e
 * margem altas) → decide sem modelo; na dúvida → o classify por modelo de sempre (lib/agent/router).
 * Modos (ROTEADOR_KNN): "off" (padrão) · "sombra" (decide pelo modelo e só REGISTRA se o kNN concordaria — pra
 * medir em prod antes de virar) · "on" (o kNN decide quando confiante).
 */
import type { IntentId } from "@/lib/agent/contracts";

/** os exemplos de cada intenção (PT-BR, do jeito que o aluno escreve) — mudou a lista, o índice se refaz sozinho */
export const EXEMPLOS: Readonly<Record<IntentId, readonly string[]>> = {
  conversa: [
    "oi", "olá, tudo bem?", "bom dia aura", "boa noite", "obrigado!", "valeu pela ajuda", "kkkk", "tchau, até amanhã",
    "você é muito legal", "tô cansado hoje", "e aí, beleza?", "obrigada, ajudou muito",
  ],
  duvida_rapida: [
    "qual a capital da austrália?", "quanto é 15% de 240?", "quem escreveu dom casmurro?", "em que ano foi a revolução francesa?",
    "qual o símbolo químico do ouro?", "quantos ossos tem o corpo humano?", "qual a fórmula da água?", "qual o plural de cidadão?",
    "quem descobriu a penicilina?", "quanto é a raiz quadrada de 144?", "qual a velocidade da luz?", "que dia cai a prova do enem?",
  ],
  explicar_conceito: [
    "o que é mitose?", "explique a fotossíntese", "como funciona a vacina de mrna?", "qual a diferença entre vírus e bactéria?",
    "me ensina derivada", "quero entender inflação", "por que o céu é azul?", "defina entropia", "como funciona um motor a combustão?",
    "explica a teoria da relatividade", "o que significa mais-valia em marx?", "faz a engenharia reversa de um transistor",
    "não entendi o que é logaritmo", "como a insulina regula a glicose?",
  ],
  gerar_artefato: [
    "faz um mapa mental sobre a segunda guerra", "cria flashcards de anatomia do coração", "gera um quiz sobre funções do segundo grau",
    "monte uma linha do tempo da revolução industrial", "faz um resumo esquematizado de citologia", "me dá uma aula sobre genética",
    "cria um diagrama do ciclo de krebs", "faz um podcast sobre o iluminismo", "gera um fluxograma da mitose",
    "quero um vídeo explicando a tabela periódica", "faz um esquema sobre as leis de newton", "cria um quiz de inglês pra mim",
  ],
  criar_trabalho: [
    "escreva um artigo sobre inteligência artificial na educação", "faz meu tcc sobre energia solar", "preciso de um relatório sobre o estágio",
    "redija uma redação sobre desigualdade social", "escreve uma monografia sobre direito penal", "faz um trabalho completo sobre o sus",
    "cria um artigo científico sobre microplásticos", "agora outro artigo sobre aquecimento global", "escreva a introdução do meu tcc",
    "faz um relatório de laboratório sobre titulação", "monta um trabalho acadêmico sobre a lei de cotas",
  ],
  pesquisar_fontes: [
    "me passa fontes sobre ansiedade em universitários", "quais artigos falam sobre crispr?", "preciso de referências sobre economia circular",
    "busca papers recentes sobre aprendizado de máquina", "bibliografia sobre a ditadura militar", "artigos científicos sobre o efeito estufa",
    "onde acho estudos sobre autismo?", "fontes confiáveis sobre vacinas", "me indica referências abnt sobre sustentabilidade",
    "pesquise artigos sobre metodologias ativas",
  ],
  revisar: [
    "revisa meu texto", "corrige minha redação", "dá uma olhada no meu resumo e diz o que melhorar", "tem erro de português aqui?",
    "avalia minha introdução", "critica meu argumento", "confere se minha resposta está certa", "melhora esse parágrafo",
    "revisa as referências do meu trabalho", "corrige a gramática desse texto",
  ],
  buscar_livro: [
    "me manda o pdf do livro sapiens", "onde baixo o livro o príncipe?", "tem o livro dom quixote pra ler?", "link do livro física básica halliday",
    "quero ler o livro 1984", "acha o livro a origem das espécies", "me passa o livro de cálculo do stewart", "onde leio memórias póstumas de brás cubas?",
    "baixar livro o pequeno príncipe", "livro de anatomia do netter em pdf",
  ],
};

export type VotoKnn = { intent: IntentId; confianca: number; margem: number; vizinhos: { intent: IntentId; sim: number }[] };
export type IndiceKnn = { versao: string; itens: { intent: IntentId; vetor: number[] }[] };

/** quando o kNN decide sozinho. Calibrado em prod (out/2026, 48 perguntas rotuladas, embedding real): com o voto
 *  exponencial, 0.65/0.25 → decide sozinho em ~77% com 100% de acerto (0.6/0.2 → 85%; os erros brutos têm margem ≤ 0,09).
 *  Ajuste fino em prod: ROTEADOR_KNN_CONFIANCA / ROTEADOR_KNN_MARGEM. */
export const LIMIAR_CONFIANCA = 0.65, LIMIAR_MARGEM = 0.25, K = 5;
/** a "temperatura" do voto: cada vizinho pesa exp((sim − sim do mais perto)/T) — o quase-idêntico manda */
export const TEMPERATURA = 0.1;
const numEnv = (v: string | undefined, padrao: number) => { const n = Number(v); return v && Number.isFinite(n) && n > 0 && n < 1 ? n : padrao; };

export const versaoDosExemplos = (): string => {
  let h = 0; const s = JSON.stringify(EXEMPLOS);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `v${(h >>> 0).toString(36)}`;
};

const cosseno = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
};

/**
 * O voto dos K vizinhos mais parecidos. Peso EXPONENCIAL relativo ao mais perto (exp((sim − top)/T)): na soma simples,
 * a pergunta idêntica a um exemplo (sim 1,0) perdia pra três exemplos medianos de outra intenção ("o que é mitose?" →
 * gerar_artefato por causa de "gera um fluxograma da mitose", medido em prod). `margem` = a fatia do 1º menos a do 2º.
 */
export function votar(vetor: number[], indice: IndiceKnn, k = K): VotoKnn | null {
  if (!indice.itens.length) return null;
  const viz = indice.itens.map((x) => ({ intent: x.intent, sim: cosseno(vetor, x.vetor) })).sort((a, b) => b.sim - a.sim).slice(0, k);
  const topo = viz[0]!.sim;
  const peso = new Map<IntentId, number>(); let total = 0;
  for (const v of viz) { const p = Math.exp((v.sim - topo) / TEMPERATURA); peso.set(v.intent, (peso.get(v.intent) ?? 0) + p); total += p; }
  const rank = [...peso].sort((a, b) => b[1] - a[1]);
  if (!rank.length || !total) return null;
  const [intent, p1] = rank[0]!, p2 = rank[1]?.[1] ?? 0;
  return { intent, confianca: viz.find((v) => v.intent === intent)!.sim, margem: (p1 - p2) / total, vizinhos: viz };
}

/** o voto basta pra decidir sem o modelo? */
export const confiante = (v: VotoKnn | null, env: Record<string, string | undefined> = process.env): v is VotoKnn =>
  !!v && v.confianca >= numEnv(env.ROTEADOR_KNN_CONFIANCA, LIMIAR_CONFIANCA) && v.margem >= numEnv(env.ROTEADOR_KNN_MARGEM, LIMIAR_MARGEM);

export type ModoKnn = "off" | "sombra" | "on";
export const modoKnn = (env: Record<string, string | undefined> = process.env): ModoKnn => {
  const v = env.ROTEADOR_KNN?.trim().toLowerCase();
  return v === "on" || v === "1" ? "on" : v === "sombra" ? "sombra" : "off";
};

// ───────────────────────────── o índice (uma vez por processo) ─────────────────────────────
type Embed = (textos: string[], tipo: "documento" | "pergunta") => Promise<number[][]>;
const g = globalThis as unknown as { __indiceKnn?: Promise<IndiceKnn> };

const gp = globalThis as unknown as { __indiceKnnPronto?: IndiceKnn };
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Monta (uma vez por processo) o índice: os vetores de todos os exemplos — o MESMO tipo de vetor da pergunta do turno.
 * A cota de embeddings do Vertex é limitada (429 medido em rajada): lote a lote, com nova tentativa e espera crescente.
 * Falhou de vez → esquece (a próxima consulta tenta de novo).
 */
export function indiceKnn(embed: Embed, esperas: readonly number[] = [5000, 15000, 30000], pausaEntreLotes = 8000): Promise<IndiceKnn> {
  if (!g.__indiceKnn) {
    const versao = versaoDosExemplos();
    const p = (async () => {
      const pares = (Object.entries(EXEMPLOS) as [IntentId, readonly string[]][]).flatMap(([intent, xs]) => xs.map((t) => ({ intent, t })));
      const vetores: number[][] = [];
      for (let i = 0; i < pares.length; i += 16) {
        if (i > 0) await dormir(pausaEntreLotes);   // a cota do embedding é por minuto: sem rajada
        const lote = pares.slice(i, i + 16).map((x) => x.t);
        for (let tentativa = 0; ; tentativa++) {
          try { vetores.push(...(await embed(lote, "pergunta"))); break; }
          catch (e) { if (tentativa >= esperas.length || !/429|RESOURCE_EXHAUSTED|quota/i.test(String((e as Error)?.message))) throw e; await dormir(esperas[tentativa]!); }
        }
      }
      const ind = { versao, itens: pares.map((x, i) => ({ intent: x.intent, vetor: vetores[i]! })) };
      gp.__indiceKnnPronto = ind;
      return ind;
    })();
    p.catch((e) => { if (g.__indiceKnn === p) g.__indiceKnn = undefined; console.warn("[roteador-knn] índice não montou:", String((e as Error)?.message ?? e).slice(0, 120)); });
    g.__indiceKnn = p;
  }
  return g.__indiceKnn;
}
/** o índice SE já estiver pronto (sem esperar: enquanto monta, a classificação vai pelo modelo) — e dispara a montagem */
export function indiceSePronto(embed: Embed, esperas?: readonly number[], pausaEntreLotes?: number): IndiceKnn | null {
  if (!gp.__indiceKnnPronto) void indiceKnn(embed, esperas, pausaEntreLotes).catch(() => undefined);
  return gp.__indiceKnnPronto ?? null;
}
/** (testes) esquece o índice */
export const _esquecerIndice = () => { g.__indiceKnn = undefined; gp.__indiceKnnPronto = undefined; };
