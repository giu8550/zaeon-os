/**
 * MEUS ESTUDOS — o BOARD (PURO, client-safe). "Meus estudos" voltou a ser o canvas onde os cards são colados e
 * arrastados, com mais de uma pessoa no board ao mesmo tempo (pedido do dono, out/2026). A estética é de BLUEPRINT
 * (o ponto focal de UX/UI e de conceito): papel azul técnico, grade, traço branco.
 *
 * Por cima dele mora o HARNESS dos estudos: um card de ESTUDO é a raiz; dentro dele se gera o PERCURSO (o Cérebro) e
 * a RESPOSTA CERTEIRA (o Scholar com as citações checadas no texto do artigo); cada resposta vira uma RAMIFICAÇÃO que
 * cresce da DIREITA pra ESQUERDA, ligada ao card de onde saiu:
 *  - CONFIRMAÇÃO: factível, checada e confirmada pela literatura (com as fontes) — card cheio;
 *  - ESPECULAÇÃO: ainda não confirmada — ganha lugar no board, mas num card MENOR e tracejado (distinguível).
 * Os cards livres (nota, pergunta) continuam: o harness é uma estrutura a mais dentro do board.
 *
 * Mora no modelo `Cartolina` (surface `meus-estudos`): dono, membros (editor/leitor), convite por link e o `rev` do
 * controle otimista vêm de graça. Tudo que chega do cliente passa por `sanitizarCard` antes de tocar o banco.
 */
export const SURFACE_ESTUDOS = "meus-estudos" as const;

export type TipoCard = "estudo" | "percurso" | "confirmacao" | "especulacao" | "nota" | "pergunta";
export const TIPOS_CARD: readonly TipoCard[] = ["estudo", "percurso", "confirmacao", "especulacao", "nota", "pergunta"];
/** os tipos do HARNESS (gerados dentro de um estudo) × os livres */
export const TIPOS_RAMO: readonly TipoCard[] = ["percurso", "confirmacao", "especulacao"];

export type Fonte = { titulo: string; url?: string; trecho?: string; ano?: number };
export type CardEstudo = {
  id: string; tipo: TipoCard;
  titulo?: string; corpo?: string;
  x: number; y: number; w: number;
  /** de qual card esta ramificação saiu (a linha liga o lado ESQUERDO do pai ao DIREITO do filho) */
  pai?: string;
  /** as fontes que confirmam (só nas confirmações) */
  fontes?: Fonte[];
  /** quem criou (userId) — pra mostrar a cor de quem colou */
  autor?: string;
  /** (só no ESTUDO) o PRODUTO FINAL — o resultado que dá pra entregar/vender (o blueprint — lib/estudos/blueprint) */
  produto?: string;
  /** (só no ESTUDO) o link do código/entregável (pode ser PRIVADO: só quem valida abre) */
  repo?: string;
  /** (só no ESTUDO) os SELOS de validação — gravados SÓ pelo servidor (o cliente não forja: `aplicarOps` mantém os do banco) */
  selos?: Selos;
};
export type Selos = {
  /** a checagem dos links (as fontes e o repositório): quantos responderam e quando */
  links?: { ok: number; total: number; em: number };
};

export const MAX_CARDS_ESTUDO = 300;
const MAX_TEXTO = 6000, MAX_TITULO = 200, MAX_ID = 64, MAX_FONTES = 8, ID_RE = /^[\w:.-]+$/;
/** a largura de cada tipo (as especulações são MENORES) */
export const LARGURA: Record<TipoCard, number> = { estudo: 380, percurso: 300, confirmacao: 320, especulacao: 230, nota: 260, pergunta: 260 };

const str = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.trim() ? v.slice(0, max) : undefined);
const num = (v: unknown, min: number, max: number): number | undefined => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined);
const idOk = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_ID && ID_RE.test(v);

/** só http(s) — nada de javascript: num link que o colega vai clicar */
export function urlSegura(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  try { const u = new URL(v.trim()); return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 500) : undefined; } catch { return undefined; }
}

/** null = card inválido (descartado) */
export function sanitizarCard(raw: unknown): CardEstudo | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (!idOk(c.id) || typeof c.tipo !== "string" || !(TIPOS_CARD as readonly string[]).includes(c.tipo)) return null;
  const tipo = c.tipo as TipoCard;
  const x = num(c.x, -40000, 40000), y = num(c.y, -40000, 40000), w = num(c.w, 160, 900) ?? LARGURA[tipo];
  if (x === undefined || y === undefined) return null;
  const card: CardEstudo = { id: c.id, tipo, x, y, w };
  const titulo = str(c.titulo, MAX_TITULO), corpo = str(c.corpo, MAX_TEXTO);
  if (titulo) card.titulo = titulo;
  if (corpo) card.corpo = corpo;
  if (idOk(c.pai) && c.pai !== c.id) card.pai = c.pai;
  if (idOk(c.autor)) card.autor = c.autor;
  if (tipo === "estudo") {
    const produto = str(c.produto, 2000), repo = urlSegura(c.repo);
    if (produto) card.produto = produto;
    if (repo) card.repo = repo;
    const l = (c.selos as Selos | undefined)?.links;
    if (l && typeof l === "object") { const ok = num(l.ok, 0, 100), total = num(l.total, 0, 100), em = num(l.em, 0, 9e15); if (ok !== undefined && total !== undefined && em !== undefined && ok <= total) card.selos = { links: { ok: Math.round(ok), total: Math.round(total), em: Math.round(em) } }; }
  }
  if (tipo === "confirmacao" && Array.isArray(c.fontes)) {
    const fs = c.fontes.map((f): Fonte | null => {
      if (!f || typeof f !== "object") return null;
      const o = f as Record<string, unknown>, t = str(o.titulo, 300); if (!t) return null;
      const fonte: Fonte = { titulo: t }, url = urlSegura(o.url), trecho = str(o.trecho, 600), ano = num(o.ano, 1500, 2100);
      if (url) fonte.url = url; if (trecho) fonte.trecho = trecho; if (ano !== undefined) fonte.ano = Math.round(ano);
      return fonte;
    }).filter((f): f is Fonte => f !== null).slice(0, MAX_FONTES);
    if (fs.length) card.fontes = fs;
  }
  return card;
}
/** o Json do banco como cards — o corrompido some em vez de lançar (e o que for do formato antigo da cartolina, também) */
export function lerCards(json: unknown): CardEstudo[] {
  return Array.isArray(json) ? json.map(sanitizarCard).filter((c): c is CardEstudo => c !== null).slice(0, MAX_CARDS_ESTUDO) : [];
}

export type OpsBoard = { upsert?: unknown[]; remove?: unknown[] };
/** aplica as operações (por card): remove primeiro, depois insere/atualiza; os filhos de um card removido viram soltos.
 *  Os SELOS são do servidor: vindos do cliente (`servidor` falso) são ignorados e os do banco ficam */
export function aplicarOps(atual: readonly CardEstudo[], ops: OpsBoard, o: { servidor?: boolean } = {}): CardEstudo[] {
  const remover = new Set((Array.isArray(ops.remove) ? ops.remove : []).filter(idOk));
  const mapa = new Map(atual.filter((c) => !remover.has(c.id)).map((c) => [c.id, c] as const));
  for (const raw of Array.isArray(ops.upsert) ? ops.upsert : []) {
    const c = sanitizarCard(raw); if (!c || remover.has(c.id)) continue;
    if (!o.servidor) { const antes = mapa.get(c.id)?.selos; delete c.selos; if (antes) c.selos = antes; }
    mapa.set(c.id, c);
  }
  const out = [...mapa.values()].slice(0, MAX_CARDS_ESTUDO);
  return out.map((c) => { if (c.pai && !mapa.has(c.pai)) { const { pai: _p, ...solto } = c; void _p; return solto; } return c; });
}
/** junta o estado REMOTO com o local sem perder o que eu ainda não salvei (`pendentes` = ids com edição minha em voo) */
export function mesclarRemoto(local: readonly CardEstudo[], remoto: readonly CardEstudo[], pendentes: ReadonlySet<string>): CardEstudo[] {
  const meus = new Map(local.filter((c) => pendentes.has(c.id)).map((c) => [c.id, c] as const));
  const out = remoto.map((c) => meus.get(c.id) ?? c);
  for (const [id, c] of meus) if (!remoto.some((r) => r.id === id)) out.push(c);
  return out;
}

// ───────────── as RAMIFICAÇÕES (da direita pra esquerda) ─────────────
/** quanto o filho fica à ESQUERDA do pai e o espaço vertical entre irmãos */
export const RAMO = { dx: 90, dy: 34 } as const;
/** onde entra um novo filho do card `pai`: à esquerda dele, embaixo do último irmão (os ramos descem em leque) */
export function posicaoDoFilho(pai: CardEstudo, irmaos: readonly CardEstudo[], tipo: TipoCard, alturaDe: (c: CardEstudo) => number): { x: number; y: number; w: number } {
  const w = LARGURA[tipo], x = pai.x - RAMO.dx - w;
  if (!irmaos.length) return { x, y: pai.y, w };
  const baixo = Math.max(...irmaos.map((i) => i.y + alturaDe(i)));
  return { x, y: baixo + RAMO.dy, w };
}
/** os filhos diretos de um card */
export const filhosDe = (cards: readonly CardEstudo[], id: string) => cards.filter((c) => c.pai === id);
/** a raiz (o card de ESTUDO) de um card, subindo pelos pais (sem laço) */
export function raizDe(cards: readonly CardEstudo[], id: string): CardEstudo | null {
  const porId = new Map(cards.map((c) => [c.id, c] as const)); let c = porId.get(id) ?? null; const vistos = new Set<string>();
  while (c && c.pai && !vistos.has(c.id)) { vistos.add(c.id); const p = porId.get(c.pai); if (!p) break; c = p; }
  return c && c.tipo === "estudo" ? c : null;
}

/** a PROFUNDIDADE de um estudo (0..100): conta as confirmações (com fonte) muito mais que as especulações, e o percurso
 *  — a métrica rigorosa que vai decidir se o estudo vira blueprint/item (fatias seguintes) */
export function profundidade(cards: readonly CardEstudo[], estudoId: string): { nota: number; confirmacoes: number; especulacoes: number; passos: number; fontes: number } {
  const ramo: CardEstudo[] = []; const fila = [estudoId], vistos = new Set<string>();
  while (fila.length) { const id = fila.shift()!; if (vistos.has(id)) continue; vistos.add(id); for (const f of filhosDe(cards, id)) { ramo.push(f); fila.push(f.id); } }
  const confirmacoes = ramo.filter((c) => c.tipo === "confirmacao" && (c.fontes?.length ?? 0) > 0).length;
  const especulacoes = ramo.filter((c) => c.tipo === "especulacao").length;
  const passos = ramo.filter((c) => c.tipo === "percurso").length;
  const fontes = new Set(ramo.flatMap((c) => (c.fontes ?? []).map((f) => (f.url ?? f.titulo).toLowerCase()))).size;
  const bruto = confirmacoes * 12 + Math.min(fontes, 15) * 3 + Math.min(passos, 10) * 2 + Math.min(especulacoes, 10) * 0.5;
  return { nota: Math.round(Math.min(100, bruto)), confirmacoes, especulacoes, passos, fontes };
}

/** um id novo de card */
export const novoIdCard = (tipo: TipoCard) => `${tipo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** o board de quem chega pela 1ª vez: um card de ESTUDO de exemplo, e uma nota explicando */
export function boardInicial(autor: string): CardEstudo[] {
  return [
    { id: "estudo-inicial", tipo: "estudo", x: 640, y: 120, w: LARGURA.estudo, autor, titulo: "Qual é o seu estudo?", corpo: "Escreva aqui o tema ou o problema. Dentro deste card você gera o PERCURSO e a RESPOSTA CERTEIRA — cada uma vira uma ramificação à esquerda." },
    { id: "nota-inicial", tipo: "nota", x: 640, y: 420, w: LARGURA.nota, autor, titulo: "Como funciona", corpo: "Confirmações (checadas na literatura) ficam em cards cheios; especulações, em cards menores e tracejados. Arraste, cole, convide alguém pro board." },
  ];
}
