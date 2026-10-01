/**
 * TCC cross-sala — o MOTOR de seções, PURO (sem Prisma, sem rede), pra ser testado à exaustão.
 *
 * O documento é uma lista de seções `{ id, titulo, corpo }`. Toda edição é uma OPERAÇÃO numa
 * seção (substituir/inserir/anexar/remover) — nunca "reescreve o arquivo todo". É isso que deixa
 * a Sala de Estudos e a Sala de Pesquisa mexerem no MESMO documento sem uma apagar a outra: só a
 * seção tocada muda, e cada operação devolve o `antes`/`depois` que vira linha de histórico.
 *
 * O `content` (markdown `# SEÇÃO`) continua existindo como ESPELHO: é o que o editor da Sala de
 * Pesquisa e o export ABNT (`parseAbntMarkers`) já sabem ler. Ver docs/HANDOFF_TCC_CROSS_SALA.md.
 */

export type Secao = { id: string; titulo: string; corpo: string };

export const OPS = ["substituir", "inserir", "anexar", "remover"] as const;
export type OpTipo = (typeof OPS)[number];
export const isOpTipo = (v: unknown): v is OpTipo => typeof v === "string" && (OPS as readonly string[]).includes(v);

export const ORIGENS = ["estudos", "pesquisa", "aluno"] as const;
export type Origem = (typeof ORIGENS)[number];
export const isOrigem = (v: unknown): v is Origem => typeof v === "string" && (ORIGENS as readonly string[]).includes(v);

/** Uma operação pedida. `secaoId` é obrigatório exceto em `inserir` (onde vale o `titulo`). */
export type OpSecao = {
  op: OpTipo;
  secaoId?: string;
  titulo?: string;
  corpo?: string;
  /** inserir: depois de qual seção (ausente/desconhecida = no fim). */
  aposId?: string | null;
};

/** O que a operação fez — vira a linha de `TccRevisao`. */
export type Efeito = { op: OpTipo; secaoId: string; titulo: string; antes: string | null; depois: string };

export type ResultadoOp =
  | { ok: true; secoes: Secao[]; efeito: Efeito }
  | { ok: false; erro: "op_invalida" | "secao_inexistente" | "secao_existente" | "sem_titulo" | "limite" };

export const MAX_SECOES = 40;
export const MAX_CORPO = 60_000;
export const MAX_TITULO = 200;
const ID_RE = /^[\w:.-]{1,64}$/;
export const isSecaoId = (v: unknown): v is string => typeof v === "string" && ID_RE.test(v);

/** minúsculas, sem acento, só [a-z0-9-] — id estável a partir do título. */
export function slugSecao(titulo: string): string {
  const s = String(titulo || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "secao";
}

/** Chave de comparação de títulos ("Introdução" == "INTRODUCAO" == " introdução "). */
export const chaveTitulo = (t: string) => slugSecao(t);

export function idUnico(base: string, usados: Set<string>): string {
  if (!usados.has(base)) return base;
  for (let i = 2; ; i++) if (!usados.has(`${base}-${i}`)) return `${base}-${i}`;
}

const limpaTitulo = (t: unknown) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim().slice(0, MAX_TITULO) : "");
const limpaCorpo = (c: unknown) => (typeof c === "string" ? c.replace(/\r\n/g, "\n").slice(0, MAX_CORPO) : "");

/** Lê o Json do banco: o que estiver corrompido some em vez de lançar; ids repetidos são descartados. */
export function readSecoes(json: unknown): Secao[] {
  if (!Array.isArray(json)) return [];
  const out: Secao[] = [];
  const vistos = new Set<string>();
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const titulo = limpaTitulo(r.titulo);
    if (!isSecaoId(r.id) || !titulo || vistos.has(r.id)) continue;
    vistos.add(r.id);
    out.push({ id: r.id, titulo, corpo: limpaCorpo(r.corpo) });
    if (out.length >= MAX_SECOES) break;
  }
  return out;
}

/** Monta seções novas a partir de títulos/corpos (ids derivados do título, sem colisão). */
export function novasSecoes(itens: { titulo: string; corpo?: string }[]): Secao[] {
  const usados = new Set<string>();
  const out: Secao[] = [];
  for (const it of itens) {
    const titulo = limpaTitulo(it.titulo);
    if (!titulo) continue;
    const id = idUnico(slugSecao(titulo), usados);
    usados.add(id);
    out.push({ id, titulo, corpo: limpaCorpo(it.corpo ?? "") });
    if (out.length >= MAX_SECOES) break;
  }
  return out;
}

/** Esqueleto ABNT de TCC — os mesmos títulos do `ABNT_TEMPLATE` do editor da Sala de Pesquisa. */
export const ESQUELETO_TCC = ["INTRODUÇÃO", "REFERENCIAL TEÓRICO", "METODOLOGIA", "RESULTADOS E DISCUSSÃO", "CONCLUSÃO", "REFERÊNCIAS"];

// ───────────────────────────── markdown ⇄ seções ─────────────────────────────

/** O espelho `content`: `# TÍTULO` + corpo. É o formato do editor e do `parseAbntMarkers`. */
export function secoesParaMarkdown(secoes: Secao[]): string {
  return secoes.map((s) => `# ${s.titulo}\n\n${s.corpo.trim()}`.trimEnd()).join("\n\n") + (secoes.length ? "\n" : "");
}

/**
 * Lê o markdown do editor de volta em seções. Só `# ` (H1) abre seção — `## Subseção` faz parte
 * do corpo, igual ao `parseAbntMarkers`. Texto antes do 1º título vira uma seção "TEXTO" (não se
 * perde). Ids vêm de `idsPorTitulo` quando o título já existia (mantém o histórico amarrado).
 */
export function secoesDeMarkdown(md: string, existentes: Secao[] = []): Secao[] {
  const blocos: { titulo: string; linhas: string[] }[] = [];
  let atual: { titulo: string; linhas: string[] } | null = null;
  for (const linha of String(md || "").replace(/\r\n/g, "\n").split("\n")) {
    if (/^# (?!#)/.test(linha)) {
      atual = { titulo: linha.slice(2).trim(), linhas: [] };
      blocos.push(atual);
    } else if (atual) {
      atual.linhas.push(linha);
    } else if (linha.trim()) {
      atual = { titulo: "TEXTO", linhas: [linha] };
      blocos.push(atual);
    }
  }
  // Reaproveita o id da seção existente de mesmo título (na ordem), senão deriva um novo.
  const livres = new Map<string, string[]>();
  for (const s of existentes) {
    const k = chaveTitulo(s.titulo);
    livres.set(k, [...(livres.get(k) ?? []), s.id]);
  }
  const usados = new Set<string>();
  const out: Secao[] = [];
  for (const b of blocos) {
    const titulo = limpaTitulo(b.titulo) || "SEÇÃO";
    const fila = livres.get(chaveTitulo(titulo));
    let id = fila?.shift();
    if (!id || usados.has(id)) id = idUnico(slugSecao(titulo), new Set([...usados, ...existentes.map((s) => s.id)]));
    usados.add(id);
    out.push({ id, titulo, corpo: limpaCorpo(b.linhas.join("\n").trim()) });
    if (out.length >= MAX_SECOES) break;
  }
  return out;
}

// ───────────────────────────── a operação ─────────────────────────────

/** Aplica UMA operação. Devolve o documento novo + o efeito (antes/depois) — ou o motivo da recusa. */
export function aplicarOp(secoes: Secao[], op: OpSecao): ResultadoOp {
  if (!op || !isOpTipo(op.op)) return { ok: false, erro: "op_invalida" };
  const corpo = limpaCorpo(op.corpo);

  if (op.op === "inserir") {
    const titulo = limpaTitulo(op.titulo);
    if (!titulo) return { ok: false, erro: "sem_titulo" };
    if (secoes.length >= MAX_SECOES) return { ok: false, erro: "limite" };
    const usados = new Set(secoes.map((s) => s.id));
    // id explícito só vale pra RESTAURAR uma seção removida (o histórico continua amarrado a ele).
    if (op.secaoId !== undefined && (!isSecaoId(op.secaoId) || usados.has(op.secaoId))) {
      return { ok: false, erro: isSecaoId(op.secaoId) ? "secao_existente" : "op_invalida" };
    }
    const id = op.secaoId ?? idUnico(slugSecao(titulo), usados);
    const nova: Secao = { id, titulo, corpo };
    const i = op.aposId ? secoes.findIndex((s) => s.id === op.aposId) : -1;
    const out = i >= 0 ? [...secoes.slice(0, i + 1), nova, ...secoes.slice(i + 1)] : [...secoes, nova];
    return { ok: true, secoes: out, efeito: { op: "inserir", secaoId: id, titulo, antes: null, depois: corpo } };
  }

  const idx = secoes.findIndex((s) => s.id === op.secaoId);
  if (idx < 0) return { ok: false, erro: "secao_inexistente" };
  const alvo = secoes[idx];

  if (op.op === "remover") {
    return {
      ok: true,
      secoes: secoes.filter((_, i) => i !== idx),
      efeito: { op: "remover", secaoId: alvo.id, titulo: alvo.titulo, antes: alvo.corpo, depois: "" },
    };
  }

  const depois = op.op === "anexar"
    ? limpaCorpo(alvo.corpo.trim() ? `${alvo.corpo.trimEnd()}\n\n${corpo.trim()}` : corpo.trim())
    : corpo;
  // Renomear junto (substituir com título) é permitido: a seção é a mesma, o id não muda.
  const titulo = op.op === "substituir" && limpaTitulo(op.titulo) ? limpaTitulo(op.titulo) : alvo.titulo;
  const out = secoes.map((s, i) => (i === idx ? { ...s, titulo, corpo: depois } : s));
  return { ok: true, secoes: out, efeito: { op: op.op, secaoId: alvo.id, titulo, antes: alvo.corpo, depois } };
}

/** Aplica várias em sequência; a primeira recusa interrompe (nada parcial sai daqui). */
export function aplicarOps(secoes: Secao[], ops: OpSecao[]): { ok: true; secoes: Secao[]; efeitos: Efeito[] } | { ok: false; erro: string; indice: number } {
  let atual = secoes;
  const efeitos: Efeito[] = [];
  for (let i = 0; i < ops.length; i++) {
    const r = aplicarOp(atual, ops[i]);
    if (!r.ok) return { ok: false, erro: r.erro, indice: i };
    atual = r.secoes;
    // "Mudança" que não muda nada não vira histórico (o autosave reenvia o mesmo texto o tempo todo).
    if (r.efeito.op === "inserir" || r.efeito.op === "remover" || r.efeito.antes !== r.efeito.depois) efeitos.push(r.efeito);
  }
  return { ok: true, secoes: atual, efeitos };
}

// ───────────────────────────── de onde vêm as operações ─────────────────────────────

/**
 * Seções que o harness devolveu (`work.sections`, Sala de Estudos) → operações: título que já
 * existe SUBSTITUI aquela seção; título novo vira seção nova no fim. O harness nunca remove.
 */
export function opsDeWork(secoes: Secao[], sections: unknown): OpSecao[] {
  if (!Array.isArray(sections)) return [];
  const porTitulo = new Map(secoes.map((s) => [chaveTitulo(s.titulo), s]));
  const ops: OpSecao[] = [];
  const vistos = new Set<string>();
  for (const raw of sections) {
    const titulo = limpaTitulo((raw as any)?.title ?? (raw as any)?.titulo);
    const corpo = limpaCorpo((raw as any)?.body ?? (raw as any)?.corpo);
    const k = chaveTitulo(titulo);
    if (!titulo || !corpo.trim() || vistos.has(k)) continue;
    vistos.add(k);
    const existe = porTitulo.get(k);
    if (existe) { if (existe.corpo !== corpo) ops.push({ op: "substituir", secaoId: existe.id, corpo }); }
    else ops.push({ op: "inserir", titulo, corpo });
  }
  return ops.slice(0, MAX_SECOES);
}

/**
 * Edição manual no editor da Sala de Pesquisa (o markdown inteiro chega pelo autosave) →
 * operações POR SEÇÃO, casando por título. Só o que de fato mudou vira operação.
 */
export function diffSecoes(atual: Secao[], novas: Secao[]): OpSecao[] {
  const ops: OpSecao[] = [];
  const restantes = new Map(atual.map((s) => [s.id, s]));
  let anterior: string | null = null;
  for (const n of novas) {
    const casada = restantes.get(n.id)
      ?? [...restantes.values()].find((s) => chaveTitulo(s.titulo) === chaveTitulo(n.titulo));
    if (casada) {
      restantes.delete(casada.id);
      if (casada.corpo !== n.corpo || casada.titulo !== n.titulo) {
        ops.push({ op: "substituir", secaoId: casada.id, corpo: n.corpo, titulo: n.titulo });
      }
      anterior = casada.id;
    } else {
      ops.push({ op: "inserir", titulo: n.titulo, corpo: n.corpo, aposId: anterior });
      anterior = null; // id da nova só existe depois de aplicar — a próxima nova vai pro fim
    }
  }
  for (const s of restantes.values()) ops.push({ op: "remover", secaoId: s.id });
  return ops;
}

/**
 * MERGE de 3 vias por seção: as operações vieram de um diff contra a versão que o editor tinha
 * (a BASE), mas o documento pode ter andado (a outra sala escreveu). Reescreve as operações pra
 * valerem sobre o estado ATUAL: substituir uma seção que sumiu vira recriá-la; remover o que já
 * sumiu não faz nada; inserir "depois de" uma seção que sumiu vai pro fim. Seções que o aluno
 * NÃO tocou nem aparecem aqui — então o que a outra sala escreveu nelas fica.
 */
export function rebasearOps(ops: OpSecao[], atual: Secao[]): OpSecao[] {
  const ids = new Set(atual.map((s) => s.id));
  const out: OpSecao[] = [];
  for (const o of ops) {
    if (o.op === "inserir") { out.push(o.aposId && !ids.has(o.aposId) ? { ...o, aposId: null } : o); continue; }
    if (o.secaoId && ids.has(o.secaoId)) { out.push(o); continue; }
    if (o.op === "substituir" && o.titulo) out.push({ op: "inserir", titulo: o.titulo, corpo: o.corpo ?? "" });
    // remover/anexar de seção que não existe mais: nada a fazer
  }
  return out;
}

/** Mesmo documento a menos de formatação (linhas em branco, espaços nas bordas das seções)? */
export function mesmoConteudo(a: string, b: string): boolean {
  const k = (md: string) => JSON.stringify(secoesDeMarkdown(md).map((s) => [s.titulo, s.corpo.trim()]));
  return a === b || k(a) === k(b);
}

/**
 * DESFAZER = restaurar a seção como estava ANTES de uma revisão aplicada (vira uma operação
 * nova: última vence, e o que se desfez continua no histórico). null = nada a fazer.
 */
export function opDeDesfazer(rev: { op: string; secaoId: string; titulo?: string | null; antes?: string | null }, secoes: Secao[]): OpSecao | null {
  const existe = secoes.find((s) => s.id === rev.secaoId);
  if (rev.op === "inserir" || rev.antes === null || rev.antes === undefined) {
    // desfazer uma criação = tirar a seção (se ainda estiver lá)
    return existe ? { op: "remover", secaoId: rev.secaoId } : null;
  }
  if (existe) return { op: "substituir", secaoId: rev.secaoId, corpo: rev.antes };
  return { op: "inserir", secaoId: rev.secaoId, titulo: rev.titulo || "SEÇÃO", corpo: rev.antes };
}

/** Quantas palavras — o resumo da seção que a bússola do TCC manda pro agente. */
export const palavras = (t: string) => (String(t || "").trim().match(/\S+/g) ?? []).length;
