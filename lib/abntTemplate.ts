/**
 * Template ABNT estruturado para o primeiro carregamento do editor de pesquisa.
 * Os marcadores `# SEÇÃO` e `## Subseção` são processados pelo parser front-end
 * antes do envio ao backend, gerando o array `sections[]` do DocumentPayload.
 *
 * Formato suportado:
 *   # TÍTULO DA SEÇÃO        → SectionData (type detectado pelo título)
 *   ## Título da Subseção    → SubsectionData dentro da seção anterior
 *   Texto livre              → content da seção/subseção atual
 */

export const ABNT_TEMPLATE = `# INTRODUÇÃO
Apresente o tema, a justificativa e os objetivos do trabalho. Contextualize o problema de pesquisa e delimite o escopo do estudo. Finalize com uma breve descrição da estrutura do trabalho.

# REFERENCIAL TEÓRICO
## Conceitos Fundamentais
Apresente os principais conceitos e teorias que embasam a pesquisa. Cite autores de referência na área (ex: SOBRENOME, Nome. Título da obra. Cidade: Editora, Ano.).

## Estado da Arte
Discuta os trabalhos relacionados mais recentes e como eles se posicionam em relação à sua pesquisa.

# METODOLOGIA
Descreva o tipo de pesquisa (qualitativa, quantitativa, experimental), os instrumentos utilizados, os critérios de coleta de dados e o método de análise.

# RESULTADOS E DISCUSSÃO
Apresente os dados coletados e discuta os achados à luz do referencial teórico. Use tabelas, gráficos ou figuras quando necessário (indicando a fonte conforme ABNT).

# CONCLUSÃO
Sintetize as principais descobertas, retome os objetivos iniciais e indique as contribuições do trabalho. Aponte limitações e sugestões para trabalhos futuros.

# REFERÊNCIAS
SOBRENOME, Nome. Título do livro em itálico: subtítulo. Edição. Cidade: Editora, Ano.
SOBRENOME, Nome. Título do artigo. Nome do Periódico, Cidade, v. N, n. N, p. XX-XX, Mês Ano.
`;

/** Verifica se o conteúdo é o template intacto ou está vazio */
export const isEmptyOrTemplate = (content: string): boolean => {
  return content.trim() === '' || content.trim() === ABNT_TEMPLATE.trim();
};

/** Tipos de seção reconhecidos pelo title */
const SECTION_TYPE_MAP: Record<string, string> = {
  'INTRODUÇÃO': 'introducao',
  'INTRODUCAO': 'introducao',
  'CONCLUSÃO': 'conclusao',
  'CONCLUSAO': 'conclusao',
  'REFERÊNCIAS': 'referencias',
  'REFERENCIAS': 'referencias',
};

function normalizeSectionType(title: string): string {
  const upper = title.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [key, type] of Object.entries(SECTION_TYPE_MAP)) {
    if (upper.includes(key)) return type;
  }
  return 'desenvolvimento';
}

export interface ParsedSection {
  type: string;
  title: string;
  content: string;
  subsections: Array<{ title: string; content: string }>;
}

/**
 * Parseia o texto do editor extraindo seções (`# TÍTULO`) e
 * subseções (`## Subtítulo`) estruturadas.
 *
 * Retorna `null` se o texto não contiver nenhum marcador `#` —
 * nesse caso o backend usa o Gemini normalmente como fallback.
 */
export function parseAbntMarkers(rawText: string): ParsedSection[] | null {
  const lines = rawText.split('\n');
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;
  let currentSubsection: { title: string; content: string } | null = null;
  let hasAnyMarker = false;

  const flushSubsection = () => {
    if (currentSubsection && currentSection) {
      currentSection.subsections.push({
        title: currentSubsection.title,
        content: currentSubsection.content.trim(),
      });
      currentSubsection = null;
    }
  };

  const flushSection = () => {
    flushSubsection();
    if (currentSection) {
      currentSection.content = currentSection.content.trim();
      sections.push(currentSection);
      currentSection = null;
    }
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      hasAnyMarker = true;
      flushSubsection();
      const subTitle = line.replace(/^## /, '').trim();
      currentSubsection = { title: subTitle, content: '' };
    } else if (line.startsWith('# ')) {
      hasAnyMarker = true;
      flushSection();
      const title = line.replace(/^# /, '').trim();
      currentSection = {
        type: normalizeSectionType(title),
        title: title.toUpperCase(),
        content: '',
        subsections: [],
      };
    } else {
      if (currentSubsection) {
        currentSubsection.content += line + '\n';
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }
  }

  flushSection();

  if (!hasAnyMarker || sections.length === 0) return null;
  return sections;
}
