/**
 * Cartolina (tema Caderno) — modelo de cards + geração pela Aura.
 *
 * A Aura DESCREVE o estudo em JSON (título + itens tipados); aqui a gente VALIDA e faz o
 * LAYOUT determinístico na cartolina (nada de pedir coordenadas pro LLM). É o mesmo
 * princípio do dac/bruin: "spec declarativa → render reviewável".
 *
 * A camada de MEMÓRIA (persistir a cartolina como memória do agente da Sala de Estudos,
 * atada ao chat) é PR à parte — ver docs/HANDOFF_CARTOLINA_MEMORIA.md.
 */

export type CardTipo = "titulo" | "nota" | "pergunta" | "exercicio" | "prancha" | "video";

export interface CartolinaCard {
  id: string;
  tipo: CardTipo;
  titulo?: string;
  corpo?: string;
  resposta?: string;   // só exercicio
  legenda?: string;    // prancha/vídeo
  x: number; y: number; w: number; rot?: number;
}

/** O que a Aura devolve (antes do layout). */
export interface AuraCartolina {
  titulo: string;
  itens: Array<{ tipo: CardTipo; titulo?: string; corpo?: string; resposta?: string; legenda?: string }>;
}

export const TIPOS: CardTipo[] = ["titulo", "nota", "pergunta", "exercicio", "prancha", "video"];

/**
 * Layout determinístico: distribui os cards numa grade suave com leve rotação "colado à
 * mão". Determinístico de propósito (mesmos itens → mesma cartolina) pra ser testável e
 * estável entre reloads. O título sempre nasce no topo-esquerda.
 */
export function layoutCartolina(aura: AuraCartolina): CartolinaCard[] {
  const cards: CartolinaCard[] = [];
  const COLS = 3;
  const COL_W = 330;
  const GAP_X = 40;
  const GAP_Y = 40;
  const x0 = 120;
  const y0 = 60;

  // título
  cards.push({ id: "c0", tipo: "titulo", titulo: aura.titulo, corpo: "caderno de estudos", x: x0, y: y0, w: 380, rot: -1.5 });

  const itens = Array.isArray(aura.itens) ? aura.itens.filter((it) => it && TIPOS.includes(it.tipo) && it.tipo !== "titulo") : [];
  itens.forEach((it, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    // rotação pseudo-aleatória estável (derivada do índice) entre -2° e +2°
    const rot = ((i * 37) % 40) / 10 - 2;
    cards.push({
      id: `c${i + 1}`,
      tipo: it.tipo,
      titulo: it.titulo,
      corpo: it.corpo,
      resposta: it.resposta,
      legenda: it.legenda,
      x: x0 + col * (COL_W + GAP_X),
      y: y0 + 180 + row * (240 + GAP_Y), // abaixo do título
      w: COL_W,
      rot,
    });
  });
  return cards;
}

/** Normaliza/valida o JSON da Aura e devolve os cards já posicionados. */
export function cardsFromAura(raw: unknown): CartolinaCard[] {
  const a = (raw ?? {}) as Partial<AuraCartolina>;
  const titulo = typeof a.titulo === "string" && a.titulo.trim() ? a.titulo.trim() : "Estudo";
  const itens = Array.isArray(a.itens) ? a.itens : [];
  return layoutCartolina({ titulo, itens: itens as AuraCartolina["itens"] });
}

export const CARTOLINA_SYSTEM = [
  "Você monta um CADERNO DE ESTUDOS visual sobre o tópico do aluno, no espírito dos",
  "manuscritos do Da Vinci: curioso, concreto, humano. Responda SOMENTE JSON no formato:",
  '{"titulo": string, "itens": [{ "tipo": "nota"|"pergunta"|"exercicio"|"prancha"|"video", "titulo"?: string, "corpo"?: string, "resposta"?: string, "legenda"?: string }]}',
  "Regras: 5 a 8 itens no total; inclua pelo menos 2 notas (conceitos-chave, corpo curto e",
  "claro), 1 pergunta instigante (corpo = a pergunta), 1 exercicio (corpo = enunciado,",
  "resposta = gabarito curto), e 1 prancha (legenda = o que seria desenhado, ex.: 'diagrama",
  "do ciclo da água'). Se fizer sentido, 1 video (titulo = nome, legenda = por que assistir).",
  "Linguagem natural de pessoa (não de IA): sem 'mergulhe', sem listas decorativas, sem",
  "negrito. Funciona pra QUALQUER assunto (ciência, música, direito). Nada de inventar fonte.",
].join(" ");

export type GenFn = (system: string, user: string, opts?: any) => Promise<any>;

/**
 * Gera a cartolina de um tópico. `gen` é injetável pra teste (default = geminiJson/Vertex).
 * Nunca lança pro caller sem rede: em erro, devolve uma cartolina mínima com o título.
 */
export async function gerarCartolina(topic: string, gen?: GenFn): Promise<CartolinaCard[]> {
  const t = (topic || "").trim();
  if (!t) return [];
  const genFn: GenFn = gen ?? (async (s, u, o) => (await import("@/lib/scholar/gemini")).geminiJson(s, u, o));
  try {
    const raw = await genFn(CARTOLINA_SYSTEM, `Tópico do aluno: ${t}`, { temperature: 0.5 });
    const cards = cardsFromAura(raw);
    // garante o título com o tópico se a Aura devolveu genérico
    if (cards[0] && cards[0].tipo === "titulo" && (!cards[0].titulo || cards[0].titulo === "Estudo")) cards[0].titulo = t;
    return cards;
  } catch {
    return cardsFromAura({ titulo: t, itens: [] });
  }
}
