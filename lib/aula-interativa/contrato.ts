/**
 * lib/aula-interativa/contrato.ts — o ROTEIRO de uma aula interativa (kind "aula"), adaptado do Papermorph.
 *
 * O Papermorph (MIT, DozenTwelve/Papermorph) transforma um PDF num livro-web animado: cada capítulo
 * é um palco 1600×900 e uma fila de BEATS; cada beat junta um trecho de narração com ações
 * marcadas (`[[marca]]` antes da palavra que dispara a animação), e checagens rápidas entre as
 * lições. Lá o Opus escreve o JavaScript de cada beat à mão. Aqui o Gemini escreve um roteiro
 * DECLARATIVO (este contrato), o código normaliza/valida e um player nosso anima — o mesmo
 * princípio do archify: IR tipado e validado ANTES de renderizar. Decisão em docs/AULA_PAPERMORPH.md.
 *
 * Forma de um capítulo (a do Papermorph): intro → lições (uma ideia cada) com checagens entre elas
 * → resumo (3–4 pontos) → prática final → placar (primeira tentativa).
 */

export type Cor = "giz" | "tarefa" | "certo" | "errado" | "azul" | "verde" | "roxo" | "laranja";
export const CORES: Cor[] = ["giz", "tarefa", "certo", "errado", "azul", "verde", "roxo", "laranja"];

/** Um item que entra no palco quando a narração chega na `marca` (ou na ordem, sem marca). */
export type Item = { texto: string; latex?: string; marca?: string; cor?: Cor; nota?: string };

/**
 * O "argumento visual" de cada lição. Papermorph: "a animação É o argumento, não decoração".
 * Cada layout é uma mudança que se vê: montar passos, comparar, seguir um fluxo/ciclo, derivar
 * uma fórmula (com o erro comum riscado), destacar um conceito, resumir.
 */
export type Cena =
  | { layout: "titulo"; kicker?: string; titulo: string; subtitulo?: string; marcaSubtitulo?: string }
  | { layout: "passos"; titulo?: string; itens: Item[]; destaque?: { indice: number; marca?: string } }
  | { layout: "comparar"; titulo?: string; esquerda: { titulo: string; itens: Item[] }; direita: { titulo: string; itens: Item[] } }
  | { layout: "fluxo"; titulo?: string; ciclo?: boolean; nos: Item[] }
  | { layout: "formula"; titulo?: string; linhas: Item[]; erro?: Item & { porque?: string } }
  | { layout: "destaque"; termo: string; definicao: string; marcaDefinicao?: string; fatos?: Item[] }
  | { layout: "resumo"; itens: Item[] };
export const LAYOUTS = ["titulo", "passos", "comparar", "fluxo", "formula", "destaque", "resumo"] as const;

export type Pergunta =
  | { tipo: "escolha"; id: string; enunciado: string; opcoes: string[]; correta: number; porque: string; porqueErrado?: (string | null)[] }
  | { tipo: "vf"; id: string; enunciado: string; afirmacoes: { texto: string; verdadeira: boolean; porque: string }[] }
  | { tipo: "lacuna"; id: string; enunciado: string; antes?: string; depois?: string; aceitas: string[]; porque: string; dica?: string };

export type TipoBeat = "intro" | "licao" | "checagem" | "resumo" | "pratica" | "fim";
export type Beat = { id: string; tipo: TipoBeat; titulo: string; narracao: string; cena?: Cena; pergunta?: Pergunta };

export type Aula = {
  titulo: string;
  area?: string;
  publico?: string;
  objetivos?: string[];
  beats: Beat[];
};

/** Tempos de cada beat (vindos do TTS): duração, quando cada marca é dita e as legendas. */
export type TempoBeat = { duracao: number; marcas: Record<string, number>; legendas: [number, string][]; audio?: string };

// ───────────────────────────── marcas na narração ─────────────────────────────

const MARCA_RE = /\[\[([a-zA-Z][\w-]{0,30})\]\]/g;

/** "Veja: [[luz]]a luz chega" → { limpa: "Veja: a luz chega", marcas: { luz: 6 } } (posição na limpa). */
export function separarMarcas(narracao: string): { limpa: string; marcas: Record<string, number> } {
  const marcas: Record<string, number> = {};
  const fonte = String(narracao || "");
  const colapsa = (t: string) => t.replace(/\s+/g, " ").replace(/^ /, "");
  let limpa = "";
  let ultimo = 0;
  for (const m of fonte.matchAll(MARCA_RE)) {
    limpa = colapsa(limpa + fonte.slice(ultimo, m.index));
    // a marca aponta pro INÍCIO da próxima palavra (pula o espaço que vier depois dela)
    if (!(m[1] in marcas)) marcas[m[1]] = limpa.length + (limpa && !limpa.endsWith(" ") && /^\s/.test(fonte.slice((m.index ?? 0) + m[0].length)) ? 1 : 0);
    ultimo = (m.index ?? 0) + m[0].length;
  }
  limpa = colapsa(limpa + fonte.slice(ultimo)).trimEnd();
  for (const k of Object.keys(marcas)) marcas[k] = Math.min(marcas[k], limpa.length);
  return { limpa, marcas };
}

// ───────────────────────────── normalização (pura) ─────────────────────────────

const txt = (v: unknown, max: number) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
};
const idSeguro = (v: unknown, i: number) =>
  String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^[^a-zA-Z]+/, "").slice(0, 24) || `b${i}`;
const cor = (v: unknown): Cor | undefined => (CORES as string[]).includes(String(v)) ? (v as Cor) : undefined;
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

function item(v: any, marcas: Set<string>, max = 90): Item | null {
  if (typeof v === "string") v = { texto: v };
  if (!v || typeof v !== "object") return null;
  const texto = txt(v.texto ?? v.text ?? v.label, max);
  const latex = typeof v.latex === "string" && v.latex.trim() ? v.latex.trim().replace(/^\$+|\$+$/g, "").slice(0, 160) : undefined;
  if (!texto && !latex) return null;
  const o: Item = { texto };
  if (latex) o.latex = latex;
  // Marca que a narração não diz → o item entra na ordem (o Papermorph quebraria; aqui só degrada).
  if (typeof v.marca === "string" && marcas.has(v.marca)) o.marca = v.marca;
  const c = cor(v.cor);
  if (c) o.cor = c;
  if (v.nota) o.nota = txt(v.nota, 60);
  return o;
}
const itens = (v: unknown, marcas: Set<string>, max: number, teto: number) =>
  arr(v).map((x) => item(x, marcas)).filter(Boolean).slice(0, teto).map((x) => ({ ...x!, texto: txt(x!.texto, max) })) as Item[];

function cena(v: any, marcas: Set<string>): Cena | undefined {
  if (!v || typeof v !== "object" || !(LAYOUTS as readonly string[]).includes(v.layout)) return undefined;
  const m = (x: unknown) => (typeof x === "string" && marcas.has(x) ? x : undefined);
  const titulo = v.titulo ? txt(v.titulo, 70) : undefined;
  switch (v.layout as Cena["layout"]) {
    case "titulo":
      return { layout: "titulo", kicker: v.kicker ? txt(v.kicker, 40) : undefined, titulo: txt(v.titulo, 80) || "Aula", subtitulo: v.subtitulo ? txt(v.subtitulo, 120) : undefined, marcaSubtitulo: m(v.marcaSubtitulo) };
    case "passos": {
      const its = itens(v.itens, marcas, 110, 6);
      if (!its.length) return undefined;
      const idx = Number(v.destaque?.indice);
      return { layout: "passos", titulo, itens: its, ...(Number.isInteger(idx) && idx >= 0 && idx < its.length ? { destaque: { indice: idx, marca: m(v.destaque?.marca) } } : {}) };
    }
    case "comparar": {
      const lado = (l: any) => ({ titulo: txt(l?.titulo, 40) || "—", itens: itens(l?.itens, marcas, 80, 5) });
      const e = lado(v.esquerda), d = lado(v.direita);
      if (!e.itens.length && !d.itens.length) return undefined;
      return { layout: "comparar", titulo, esquerda: e, direita: d };
    }
    case "fluxo": {
      const nos = itens(v.nos, marcas, 40, 6);
      if (nos.length < 2) return undefined;
      return { layout: "fluxo", titulo, ciclo: !!v.ciclo, nos };
    }
    case "formula": {
      const linhas = itens(v.linhas, marcas, 90, 5);
      if (!linhas.length) return undefined;
      const erro = item(v.erro, marcas);
      return { layout: "formula", titulo, linhas, ...(erro ? { erro: { ...erro, porque: v.erro?.porque ? txt(v.erro.porque, 100) : undefined } } : {}) };
    }
    case "destaque":
      if (!v.termo) return undefined;
      return { layout: "destaque", termo: txt(v.termo, 50), definicao: txt(v.definicao, 180), marcaDefinicao: m(v.marcaDefinicao), fatos: itens(v.fatos, marcas, 90, 3) };
    case "resumo": {
      const its = itens(v.itens, marcas, 110, 4);
      return its.length ? { layout: "resumo", itens: its } : undefined;
    }
  }
}

function pergunta(v: any, id: string): Pergunta | undefined {
  if (!v || typeof v !== "object") return undefined;
  const enunciado = txt(v.enunciado ?? v.prompt, 220);
  if (!enunciado) return undefined;
  if (v.tipo === "escolha") {
    const opcoes = arr(v.opcoes).map((o) => txt(o, 120)).filter(Boolean).slice(0, 5);
    const correta = Number(v.correta);
    if (opcoes.length < 2 || !Number.isInteger(correta) || correta < 0 || correta >= opcoes.length) return undefined;
    const porqueErrado = opcoes.map((_, i) => (i === correta ? null : v.porqueErrado?.[i] ? txt(v.porqueErrado[i], 160) : null));
    return { tipo: "escolha", id, enunciado, opcoes, correta, porque: txt(v.porque, 200) || "É isso.", porqueErrado };
  }
  if (v.tipo === "vf") {
    const afirmacoes = arr(v.afirmacoes)
      .filter((a) => a && typeof a.texto === "string" && typeof a.verdadeira === "boolean")
      .slice(0, 4)
      .map((a) => ({ texto: txt(a.texto, 140), verdadeira: a.verdadeira, porque: txt(a.porque, 160) }));
    return afirmacoes.length ? { tipo: "vf", id, enunciado, afirmacoes } : undefined;
  }
  if (v.tipo === "lacuna") {
    const aceitas = arr(v.aceitas).map((a) => txt(a, 40)).filter(Boolean).slice(0, 6);
    if (!aceitas.length) return undefined;
    return { tipo: "lacuna", id, enunciado, antes: v.antes ? txt(v.antes, 80) : undefined, depois: v.depois ? txt(v.depois, 80) : undefined, aceitas, porque: txt(v.porque, 200) || "É isso.", dica: v.dica ? txt(v.dica, 140) : undefined };
  }
  return undefined;
}

export type Problema = string;

/**
 * O roteiro do modelo → uma Aula que o player sabe tocar. Conserta o mecânico (ids, marcas
 * órfãs, tetos, tipos) e devolve os PROBLEMAS de estrutura que só o modelo resolve (sem
 * lições, sem checagem, sem prática) — o pipeline manda esses de volta pra reparo.
 */
export function normalizarAula(bruto: any, tituloPadrao = "Aula"): { aula: Aula; problemas: Problema[] } {
  const src = bruto && typeof bruto === "object" ? bruto : {};
  const vistos = new Set<string>();
  const beats: Beat[] = [];
  arr(src.beats).slice(0, 16).forEach((b: any, i: number) => {
    if (!b || typeof b !== "object") return;
    const tipo: TipoBeat = ["intro", "licao", "checagem", "resumo", "pratica", "fim"].includes(b.tipo) ? b.tipo : "licao";
    let id = idSeguro(b.id ?? `${tipo}${i}`, i);
    while (vistos.has(id)) id = `${id}_${i}`;
    vistos.add(id);
    const narracao = String(b.narracao ?? "").replace(/\s+/g, " ").trim().slice(0, 900);
    const { marcas } = separarMarcas(narracao);
    const conj = new Set(Object.keys(marcas));
    const beat: Beat = { id, tipo, titulo: txt(b.titulo, 60) || tipo, narracao };
    const c = cena(b.cena, conj);
    if (c) beat.cena = c;
    if (tipo === "checagem" || tipo === "pratica") {
      const p = pergunta(b.pergunta, `${tipo === "checagem" ? "c" : "p"}-${id}`);
      if (p) beat.pergunta = p;
      else return; // pergunta inválida: o beat de pergunta não existe sem ela
    }
    if (tipo === "resumo" && beat.cena?.layout !== "resumo") delete beat.cena;
    beats.push(beat);
  });

  const titulo = txt(src.titulo, 90) || tituloPadrao;
  // Moldura garantida: começa na intro e termina no placar (o player monta o placar sozinho).
  if (beats[0]?.tipo !== "intro") {
    beats.unshift({ id: "intro", tipo: "intro", titulo: "Abertura", narracao: `Aula: ${titulo}.`, cena: { layout: "titulo", kicker: src.area ? txt(src.area, 40) : "Aula", titulo } });
  }
  const semFim = beats.filter((b) => b.tipo !== "fim");
  semFim.push({ id: "fim", tipo: "fim", titulo: "Placar", narracao: "Muito bem. Esse foi o fim da aula." });
  const final = semFim;

  const problemas: Problema[] = [];
  const licoes = final.filter((b) => b.tipo === "licao" && b.cena);
  if (licoes.length < 3) problemas.push(`só ${licoes.length} lição(ões) com cena válida; precisa de 3 a 8, uma ideia cada`);
  if (!final.some((b) => b.tipo === "checagem")) problemas.push("nenhuma checagem rápida entre as lições");
  if (!final.some((b) => b.tipo === "pratica")) problemas.push("nenhuma questão de prática final");
  if (!final.some((b) => b.tipo === "resumo")) problemas.push("faltou o resumo com 3–4 pontos");
  for (const b of final) if (!b.narracao && b.tipo !== "fim") problemas.push(`beat ${b.id} sem narração`);

  return {
    aula: {
      titulo,
      ...(src.area ? { area: txt(src.area, 40) } : {}),
      ...(src.publico ? { publico: txt(src.publico, 80) } : {}),
      ...(arr(src.objetivos).length ? { objetivos: arr(src.objetivos).map((o) => txt(o, 120)).filter(Boolean).slice(0, 4) } : {}),
      beats: final,
    },
    problemas,
  };
}

/** Corrige resposta de lacuna: sem acento/caixa/espaço, vírgula = ponto, frações equivalentes. */
export function confereLacuna(resposta: string, aceitas: string[]): boolean {
  const n = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim().replace(",", ".");
  const num = (s: string) => {
    const t = n(s);
    const f = t.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
    if (f) { const d = Number(f[2]); return d === 0 ? NaN : Number(f[1]) / d; }
    return /^-?\d+(?:\.\d+)?$/.test(t) ? Number(t) : NaN;
  };
  const r = n(resposta);
  if (!r) return false;
  return aceitas.some((a) => {
    if (n(a) === r) return true;
    const x = num(a), y = num(r);
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 1e-9;
  });
}
