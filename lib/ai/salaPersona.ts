/**
 * lib/ai/salaPersona.ts — persona/harness POR SALA (fonte única). Duas salas, dois comportamentos:
 *
 *  - Sala de ESTUDOS: objetiva e adaptável. Responde direto, no tom certo pro que foi pedido; NÃO força
 *    fonte nem revisão acadêmica em toda resposta (fonte/estrutura só quando a pergunta pede).
 *  - Sala de PESQUISA: SEMPRE fundamentada (pipeline grounded). Toda resposta com fontes e citações —
 *    a única sala onde fonte/revisão são obrigatórias.
 *
 * Nas duas: NUNCA terminar em beco ("não encontrei nada"). Ordem de preferência da resposta:
 * fonte acadêmica → web → conhecimento do modelo (deixando claro, em 1 linha, quando NÃO veio de fonte
 * acadêmica indexada). Usado pelos clientes (systemContext) e pelo draft do harness.
 */
export type Sala = "estudos" | "pesquisa";

/** Regra anti-beco, comum às duas salas. */
export const REGRA_SEM_BECO =
  "NUNCA termine em beco sem saída: não responda só 'não encontrei' / 'não foram encontradas respostas'. " +
  "Responda SEMPRE a pergunta, nesta ordem de preferência: (1) fontes acadêmicas reunidas, (2) resultados " +
  "da internet reunidos, (3) o conhecimento geral do modelo — e, quando a resposta NÃO vier de fonte " +
  "acadêmica indexada, diga isso em UMA linha curta e siga entregando a resposta.";

export const DIRETRIZ_ESTUDOS =
  "SALA DE ESTUDOS — objetiva e adaptável: responda direto, no tom e no tamanho que o pedido pede " +
  "(pergunta simples = resposta curta e direta). NÃO force fontes, citações, revisão nem estrutura " +
  "acadêmica em toda resposta; use evidência/estrutura só quando a pergunta pedir ou quando uma fonte " +
  "realmente ajudar. O rigor acadêmico pleno só vale se o pedido for criar/revisar um trabalho. " + REGRA_SEM_BECO;

export const DIRETRIZ_PESQUISA =
  "SALA DE PESQUISA — SEMPRE fundamentada: rigor acadêmico, linguagem formal em PT-BR e fontes em TODA " +
  "resposta (título e link no final). Prefira papers e periódicos revisados; NUNCA invente citações, " +
  "autores, números ou DOIs. " + REGRA_SEM_BECO;

export const diretrizDaSala = (sala: Sala): string => (sala === "pesquisa" ? DIRETRIZ_PESQUISA : DIRETRIZ_ESTUDOS);

/** A sala a partir do academicMode/surface do harness: pesquisa = enforced. */
export const salaDoModo = (academicMode: string | undefined | null): Sala => (academicMode === "enforced" ? "pesquisa" : "estudos");
