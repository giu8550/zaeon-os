/**
 * lib/rag/areas.ts — as BASES POR ÁREA dos mentores (conhecimento público especializado no RAG). PURO.
 *
 * Cada área é uma "turma" pública da base: os trechos têm `turma_ids = ['area:<slug>']` e a busca do turno inclui
 * `area:<slug>` quando o mentor dessa área está ativo (lib/rag/turno), e `area:geral` sempre — sem mexer no esquema
 * do Postgres nem na regra de permissão. Os slugs são os dos 13 mentores (lib/agent/mentors.ts).
 *
 * Fontes (scripts/ingerir-bases-area.ts, licenças que permitem uso comercial — decisão do dono, 2026-10-22):
 *   - SciELO em português (dataseek/ptbr-scielo, CC-BY-4.0): título + resumo, classificado por área pelos `termos`.
 *   - Wikipédia em português (CC-BY-SA): os `wikipedia` de cada área (conceitos centrais).
 *   - Medicina/enfermagem/farmácia: rhaymison/medicine-* (Apache-2.0). Geral: maritaca-ai/enem (Apache-2.0).
 */
export const PREFIXO_AREA = "area:";
export const AREA_GERAL = "geral";
export const idArea = (slug: string) => `${PREFIXO_AREA}${slug}`;

export type Area = {
  slug: string;
  /** Palavras (sem acento, minúsculas) que puxam um artigo pra área — prefixo de palavra, ou palavra inteira com `$` no fim
   *  ("estrutural$" não pega "estruturalismo"). Título vale 3×. */
  termos: string[];
  /** Verbetes da Wikipédia pt com os conceitos centrais. */
  wikipedia: string[];
};

export const AREAS: readonly Area[] = [
  { slug: "medicina", termos: ["paciente", "pacientes", "clinic", "cirurg", "diagnost", "tratamento", "hospital", "doenca", "sindrome", "terapia", "mortalidade", "neoplasia", "cancer", "cardio", "pediatr"],
    wikipedia: ["Medicina", "Anatomia humana", "Fisiologia humana", "Farmacologia", "Semiologia médica", "Sistema cardiovascular", "Sistema imunitário", "Diabetes mellitus", "Hipertensão arterial", "Epidemiologia", "Medicina baseada em evidências", "Exame físico"] },
  { slug: "enfermagem", termos: ["enfermagem", "enfermeir", "cuidado", "cuidador", "assistencia", "atencao primaria", "humanizacao", "auxiliar de enfermagem", "sistematizacao"],
    wikipedia: ["Enfermagem", "Sinais vitais", "Biossegurança", "Atenção primária à saúde", "Sistema Único de Saúde", "Cuidados paliativos", "Infecção hospitalar"] },
  { slug: "biologia", termos: ["especie", "especies", "ecolog", "genetic", "evolu", "biodiversidade", "celula", "celular", "fauna", "flora", "molecular", "taxonom"],
    wikipedia: ["Biologia", "Célula", "Genética", "Evolução", "Ecologia", "DNA", "Fotossíntese", "Respiração celular", "Mitose", "Meiose", "Biodiversidade", "Seleção natural"] },
  { slug: "eng-computacao", termos: ["algoritm", "software", "computacao$", "computacional", "aprendizado de maquina", "rede neural", "redes neurais", "banco de dados", "mineracao de dados", "ciencia de dados", "sistema de informacao", "programacao", "inteligencia artificial", "linguagem de programacao"],
    wikipedia: ["Ciência da computação", "Algoritmo", "Estrutura de dados", "Engenharia de software", "Aprendizado de máquina", "Rede neural artificial", "Banco de dados", "Sistema operativo", "Rede de computadores", "Criptografia", "Blockchain"] },
  { slug: "eng-energias", termos: ["energia", "solar", "eolic", "fotovolta", "eletric", "biocombust", "biomassa", "hidreletric", "renovave", "biogas"],
    wikipedia: ["Energia renovável", "Energia solar", "Energia eólica", "Célula fotovoltaica", "Energia hidrelétrica", "Biocombustível", "Sistemas elétricos de potência", "Eficiência energética", "Termodinâmica"] },
  { slug: "matematica", termos: ["matematic", "teorema", "equac", "algebra", "geometri", "probabilidade", "calculo diferencial", "modelagem matematica"],
    wikipedia: ["Matemática", "Cálculo", "Álgebra linear", "Geometria", "Estatística", "Probabilidade", "Equação diferencial", "Teoria dos números", "Função (matemática)", "Trigonometria"] },
  { slug: "fisica", termos: ["fisica quantica", "quantic", "particulas$", "eletromagnet", "optica$", "termodinam", "mecanica classica", "mecanica quantica", "relatividade", "semicondutor", "ensino de fisica", "astrofisica"],
    wikipedia: ["Física", "Mecânica clássica", "Eletromagnetismo", "Termodinâmica", "Mecânica quântica", "Relatividade geral", "Óptica", "Leis de Newton", "Energia cinética", "Física de partículas"] },
  { slug: "agronomia", termos: ["cultivar", "cultivo", "solo", "safra", "irrigac", "adubac", "produtividade", "lavoura", "milho", "soja", "agricol", "agronom", "plantio", "sementes"],
    wikipedia: ["Agronomia", "Agricultura", "Ciência do solo", "Irrigação", "Adubação", "Rotação de culturas", "Agricultura de precisão", "Controle biológico", "Agroecologia"] },
  { slug: "quimica", termos: ["quimic", "sintese quimica", "reacao quimica", "catalis", "polimer", "compostos organicos", "molecula", "espectroscop", "cromatograf", "oxidacao"],
    wikipedia: ["Química", "Tabela periódica", "Ligação química", "Reação química", "Química orgânica", "Estequiometria", "Equilíbrio químico", "Ácido", "Catálise", "Polímero"] },
  { slug: "eng-civil", termos: ["concreto", "estrutural$", "estruturas de concreto", "construcao civil", "edificac", "edificio", "fundacoes$", "pavimento", "saneamento", "geotecn", "argamassa", "alvenaria"],
    wikipedia: ["Engenharia civil", "Concreto armado", "Resistência dos materiais", "Mecânica dos solos", "Fundação (construção)", "Saneamento básico", "Pavimento", "Hidráulica"] },
  { slug: "veterinaria", termos: ["bovin", "suin", "equin", "canin", "felin", "caes", "gatos", "veterinari", "rebanho", "aves", "ovinos", "caprinos", "zoonose"],
    wikipedia: ["Medicina veterinária", "Zoonose", "Bovinocultura", "Saúde animal", "Vacinação", "Bem-estar animal", "Parasitologia"] },
  { slug: "psicologia", termos: ["psicolog", "comportament", "ansiedade", "depressao", "saude mental", "cognitiv", "emocional", "psiquiatr", "subjetividade"],
    wikipedia: ["Psicologia", "Psicologia cognitiva", "Behaviorismo", "Psicanálise", "Transtorno de ansiedade", "Transtorno depressivo maior", "Desenvolvimento humano", "Neuropsicologia", "Psicologia social"] },
  { slug: "farmacia", termos: ["farmac", "medicamento", "farmaco", "fitoterap", "dosagem", "posologia", "excipiente", "biodisponibilidade", "toxicolog"],
    wikipedia: ["Farmácia", "Farmacologia", "Farmacocinética", "Farmacodinâmica", "Medicamento genérico", "Fitoterapia", "Toxicologia", "Antibiótico"] },
];

export const SLUGS_AREA: readonly string[] = AREAS.map((a) => a.slug);

const norm = (s: string) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Conta as ocorrências de cada termo (prefixo de palavra; palavra inteira quando termina em `$`). */
function pontuar(texto: string, termos: string[]): number {
  let n = 0;
  for (const t of termos) {
    const inteira = t.endsWith("$");
    const re = new RegExp(`\\b${t.replace(/\$$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${inteira ? "\\b" : ""}`, "g");
    n += (texto.match(re) ?? []).length;
  }
  return n;
}

/**
 * A área de um artigo pelo título + resumo. null quando nenhuma área se destaca: pontuação mínima 5 e pelo menos
 * 1,5× a segunda — artigo interdisciplinar ambíguo fica fora (melhor sem fonte que com fonte da área errada).
 */
export function classificarArea(titulo: string, resumo: string): { slug: string; pontos: number } | null {
  const t = norm(titulo), r = norm(resumo);
  const placar = AREAS.map((a) => ({ slug: a.slug, pontos: pontuar(t, a.termos) * 3 + pontuar(r, a.termos) })).sort((x, y) => y.pontos - x.pontos);
  const [primeira, segunda] = placar;
  if (!primeira || primeira.pontos < 5) return null;
  if (segunda && segunda.pontos > 0 && primeira.pontos < segunda.pontos * 1.5) return null;
  return primeira;
}

/** As bases que entram na busca do turno: a área do mentor ativo (se for uma das 13) + a geral. */
export function areasDoTurno(mentorSlug: string | null | undefined): string[] {
  const out = [idArea(AREA_GERAL)];
  if (mentorSlug && SLUGS_AREA.includes(mentorSlug)) out.unshift(idArea(mentorSlug));
  return out;
}

/** Artigo da SciELO (texto completo do dataset) → título + resumo, sem o corpo inteiro. */
export function tituloEResumo(texto: string, maxResumo = 2400): { titulo: string; resumo: string } {
  const t = String(texto ?? "").replace(/\r/g, "");
  const quebra = t.indexOf("\n");
  const titulo = (quebra > 0 ? t.slice(0, quebra) : t.slice(0, 200)).trim().slice(0, 300);
  let corpo = (quebra > 0 ? t.slice(quebra + 1) : "").trim();
  const ini = norm(corpo).search(/\b(resumo|abstract)\b/);
  if (ini >= 0 && ini < 1500) corpo = corpo.slice(ini);
  return { titulo, resumo: corpo.slice(0, maxResumo).trim() };
}
