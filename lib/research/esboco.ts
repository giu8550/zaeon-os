/**
 * O prompt do ESBOÇO de pesquisa (básico, não experimental) — compartilhado entre
 * `/api/ai/research-draft` (Sala de Pesquisa) e a geração em background do TCC cross-sala
 * (`lib/tcc/gerar.ts`). Um lugar só: os dois caminhos não divergem no que pedem ao modelo.
 */
export interface DraftJson {
  titulo?: string;
  resumo?: string;
  palavrasChave?: string;
  introducao?: string;
  objetivos?: string;
  justificativa?: string;
  metodologia?: string;
  referencias?: string;
}

export const ESBOCO_SYS = [
  "Você é um orientador acadêmico. Gere um ESBOÇO de pesquisa em PT-BR — básico e didático",
  "(NÃO experimental), pra dar um norte ao aluno começar o trabalho dele.",
  "NÃO escreva títulos de seção nem numeração — só o MIOLO de cada campo (o sistema já tem o esqueleto).",
  "Responda APENAS um JSON com estas chaves (strings):",
  "{",
  '  "titulo": "título claro e específico",',
  '  "resumo": "3-4 frases",',
  '  "palavrasChave": "termo1; termo2; termo3",',
  '  "introducao": "contexto + problema + pergunta de pesquisa (1-2 parágrafos)",',
  '  "objetivos": "1 objetivo geral + 2-3 específicos, separados por quebra de linha",',
  '  "justificativa": "aponte UMA lacuna/ângulo original (o pioneirismo) e por que importa",',
  '  "metodologia": "abordagem simples: tipo de pesquisa, fontes, passos",',
  '  "referencias": "as fornecidas, formato autor-data, uma por linha (ou vazio)"',
  "}",
  "Seja conciso e concreto. Não invente dados nem referências.",
].join("\n");

export function esbocoUser(topic: string, refs: string[] = []): string {
  return `Tema do estudo: ${topic}\n\nReferências disponíveis:\n${refs.length ? refs.map((r, i) => `${i + 1}. ${r}`).join("\n") : "(nenhuma fornecida)"}`;
}
