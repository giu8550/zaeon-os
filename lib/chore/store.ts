/**
 * lib/chore/store.ts — persistência da AgentChore (C8) + funções PURAS de identidade e rota.
 *
 * `criarChore` FIXA `destino`, `tipo` e `expiraEm` (plan-then-execute, §3.B): nada que a chore lê
 * depois muda onde ela age. Idempotente por `jobId` (P2002 → devolve a existente).
 * `rotaDaChore` é a regra §8.10 em código: SÓ conteúdo "web" vai ao pool (gateway); anexo e canal
 * (dado de aluno/da sala) vão ao Vertex. Sem exceção "é só um resumo".
 */
import { createHash } from "node:crypto";
import { expiraEmDe } from "@/lib/queue/reenfileirar";

export const TIPOS_CHORE = [
  "checar_pagina", "feed_novos", "resumir_link", "classificar_anexo", "extrair_campos",
  "digest", "link_rot", "formatar_abnt", "traduzir_trecho",
] as const;
export type TipoChore = (typeof TIPOS_CHORE)[number];
export const ehTipoChore = (v: unknown): v is TipoChore => typeof v === "string" && (TIPOS_CHORE as readonly string[]).includes(v);

export type OrigemConteudo = "web" | "anexo" | "canal";
export type StatusChore = "queued" | "running" | "delayed" | "done" | "skipped" | "failed" | "expired";

/** O QUE LER (dado — nunca instrução). */
export type AlvoChore = {
  url?: string; urls?: string[]; feedUrl?: string; anexoId?: string; texto?: string;
  campos?: string[]; classes?: string[]; referencia?: Record<string, unknown>; de?: string; para?: string;
};
/** ONDE/COMO AGIR — fixado na criação. */
export type DestinoChore = { canalId: string | null; parentId: string | null; modo: "thread" | "digest" | "silencioso" };

export type ResultadoChore = {
  texto?: string; campos?: Record<string, string | null>; classe?: string; diff?: { mudou: boolean; trechos: string[] };
  itens?: unknown[]; fonteUrl?: string | null; lidoEm?: string | null; modelo?: string | null; provedor?: string | null;
  alvo?: string | null; bytes?: number | null; postado?: boolean; mensagemId?: string | null; silencioso?: boolean;
};

export type ChoreRow = {
  id: string; tipo: TipoChore; agentKey: string; requesterId: string | null; canalId: string | null;
  alvo: AlvoChore; destino: DestinoChore; origemConteudo: OrigemConteudo; status: StatusChore;
  resultado: ResultadoChore | null; cursor: string | null; motivo: string | null; chamadasLlm: number; ms: number;
  jobId: string; expiraEm: Date; createdAt: Date; updatedAt: Date;
};
export type ChoreCursorRow = {
  id: string; fonteHash: string; tipo: string; ultimoCursor: string | null; ultimaChecagemEm: Date;
  ultimaMudancaEm: Date | null; checagens: number; mudancas: number;
};

/** O pedaço do Prisma que o store usa (injetável em teste). */
export type ChoreDb = {
  agentChore: {
    create(a: { data: Record<string, unknown> }): Promise<any>;
    findUnique(a: { where: { id: string } | { jobId: string } }): Promise<any | null>;
    update(a: { where: { id: string }; data: Record<string, unknown> }): Promise<any>;
    findMany(a: { where: Record<string, unknown>; orderBy?: Record<string, unknown>; take?: number }): Promise<any[]>;
    count(a: { where: Record<string, unknown> }): Promise<number>;
  };
  choreCursor: {
    findUnique(a: { where: { fonteHash: string } }): Promise<any | null>;
    upsert(a: { where: { fonteHash: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<any>;
  };
};

// ───────────────────────────── PURAS ─────────────────────────────

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** URL canônica: sem fragmento, sem utm_xxx, fbclid, gclid, host minúsculo, query ordenada. Inválida → trim. */
export function urlCanonica(u: string): string {
  try {
    const url = new URL(String(u).trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    const q = [...url.searchParams.entries()].filter(([k]) => !/^utm_/i.test(k) && !/^(fbclid|gclid|mc_eid|mc_cid)$/i.test(k)).sort(([a], [b]) => a.localeCompare(b));
    url.search = "";
    for (const [k, v] of q) url.searchParams.append(k, v);
    return url.toString();
  } catch {
    return String(u ?? "").trim();
  }
}

function canonico(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonico);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => [k, canonico(o[k])]));
  }
  return v;
}

/** PURO — ordena chaves e normaliza URLs (url, feedUrl, urls[]). Mesmo alvo → mesma string. */
export function alvoCanonico(tipo: string, alvo: AlvoChore): string {
  const a: Record<string, unknown> = { ...alvo };
  if (typeof a.url === "string") a.url = urlCanonica(a.url);
  if (typeof a.feedUrl === "string") a.feedUrl = urlCanonica(a.feedUrl);
  if (Array.isArray(a.urls)) a.urls = (a.urls as string[]).map(urlCanonica);
  return JSON.stringify({ tipo, alvo: canonico(a) });
}

/** PURO — chore:<tipo>:<hash12>:<YYYY-MM-DD>[.<rodada>]. `rodada` (opcional) só para re-checar no mesmo dia. */
export function jobIdDe(tipo: string, alvo: AlvoChore, dia: string, rodada?: string | number): string {
  const h = sha256(alvoCanonico(tipo, alvo)).slice(0, 12);
  const r = rodada == null || rodada === "" ? "" : `.${String(rodada).replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return `chore:${tipo}:${h}:${dia}${r}`;
}

/** A chave da ChoreCursor ("registra que checou"): uma por fonte. */
export const fonteHashDe = (tipo: string, alvo: AlvoChore): string => sha256(alvoCanonico(tipo, alvo));

/** PURO — "web" → gateway (pool grátis); anexo|canal → vertex (§8.10). Qualquer outra coisa → vertex. */
export function rotaDaChore(origemConteudo: string): "gateway" | "vertex" {
  return origemConteudo === "web" ? "gateway" : "vertex";
}

/** YYYY-MM-DD em UTC. */
export const diaDe = (d: Date): string => d.toISOString().slice(0, 10);

// ───────────────────────────── persistência ─────────────────────────────

export type CriarChoreInput = {
  tipo: TipoChore; agentKey: string; requesterId?: string | null; canalId?: string | null;
  alvo: AlvoChore; destino: DestinoChore; origemConteudo: OrigemConteudo; rodada?: string | number; agora?: Date;
};

const OID = /^[a-f0-9]{24}$/i;
const oid = (v: string | null | undefined) => (v && OID.test(v) ? v : null);

/** Idempotente por jobId (P2002 → devolve a existente). FIXA destino e expiraEm. */
export async function criarChore(db: ChoreDb, input: CriarChoreInput): Promise<ChoreRow> {
  const agora = input.agora ?? new Date();
  const jobId = jobIdDe(input.tipo, input.alvo, diaDe(agora), input.rodada);
  const destino: DestinoChore = { canalId: oid(input.destino.canalId), parentId: oid(input.destino.parentId), modo: input.destino.modo };
  const data = {
    tipo: input.tipo, agentKey: input.agentKey, requesterId: oid(input.requesterId), canalId: oid(input.canalId ?? destino.canalId),
    alvo: input.alvo, destino, origemConteudo: input.origemConteudo, status: "queued", jobId, expiraEm: expiraEmDe(agora),
  };
  try {
    return (await db.agentChore.create({ data })) as ChoreRow;
  } catch (e: any) {
    if (e?.code === "P2002" || /unique|duplicate|E11000/i.test(String(e?.message))) {
      const existente = await db.agentChore.findUnique({ where: { jobId } });
      if (existente) return existente as ChoreRow;
    }
    throw e;
  }
}

export async function iniciar(db: ChoreDb, id: string): Promise<void> {
  await db.agentChore.update({ where: { id }, data: { status: "running", motivo: null } });
}

async function tocarCursor(db: ChoreDb, row: Pick<ChoreRow, "tipo" | "alvo">, cursor: string | null, mudou: boolean, agora: Date) {
  const fonteHash = fonteHashDe(row.tipo, row.alvo);
  await db.choreCursor.upsert({
    where: { fonteHash },
    create: { fonteHash, tipo: row.tipo, ultimoCursor: cursor, ultimaChecagemEm: agora, ultimaMudancaEm: mudou ? agora : null, checagens: 1, mudancas: mudou ? 1 : 0 },
    update: { ...(cursor ? { ultimoCursor: cursor } : {}), ultimaChecagemEm: agora, ...(mudou ? { ultimaMudancaEm: agora, mudancas: { increment: 1 } } : {}), checagens: { increment: 1 } },
  });
}

/** skipped + ChoreCursor.checagens++ (lei 6: diff vazio não fala nem gasta, mas registra que checou). */
export async function pular(db: ChoreDb, row: Pick<ChoreRow, "id" | "tipo" | "alvo">, motivo: "sem_mudanca", extra: { cursor?: string | null; ms?: number; chamadasLlm?: number } = {}, agora = new Date()): Promise<void> {
  await db.agentChore.update({ where: { id: row.id }, data: { status: "skipped", motivo, cursor: extra.cursor ?? null, ms: extra.ms ?? 0, chamadasLlm: extra.chamadasLlm ?? 0 } });
  await tocarCursor(db, row, extra.cursor ?? null, false, agora);
}

/** Grava `resultado` ANTES de done; ChoreCursor.mudancas++ quando houve diff (só nos tipos com cursor). */
export async function concluir(db: ChoreDb, row: Pick<ChoreRow, "id" | "tipo" | "alvo">, resultado: ResultadoChore, extra: { cursor?: string | null; ms?: number; chamadasLlm?: number; comCursor?: boolean } = {}, agora = new Date()): Promise<void> {
  await db.agentChore.update({ where: { id: row.id }, data: { resultado, cursor: extra.cursor ?? null, ms: extra.ms ?? 0, chamadasLlm: extra.chamadasLlm ?? 0 } });
  await db.agentChore.update({ where: { id: row.id }, data: { status: "done", motivo: null } });
  if (extra.comCursor) await tocarCursor(db, row, extra.cursor ?? null, true, agora);
}

export async function adiar(db: ChoreDb, id: string, ate: Date): Promise<void> {
  await db.agentChore.update({ where: { id }, data: { status: "delayed", motivo: `volta em ${ate.toISOString()}` } });
}

export async function expirar(db: ChoreDb, id: string, motivo = "pool_esgotado_expirado"): Promise<void> {
  await db.agentChore.update({ where: { id }, data: { status: "expired", motivo } });
}

export async function falhar(db: ChoreDb, id: string, motivo: string, extra: { ms?: number; chamadasLlm?: number } = {}): Promise<void> {
  await db.agentChore.update({ where: { id }, data: { status: "failed", motivo: String(motivo).slice(0, 120), ...(extra.ms != null ? { ms: extra.ms } : {}), ...(extra.chamadasLlm != null ? { chamadasLlm: extra.chamadasLlm } : {}) } });
}

export async function listar(db: ChoreDb, filtro: { canalId?: string; agentKey?: string; status?: StatusChore; tipo?: TipoChore; desde?: Date; take?: number }): Promise<ChoreRow[]> {
  const where: Record<string, unknown> = {};
  if (filtro.canalId) where.canalId = filtro.canalId;
  if (filtro.agentKey) where.agentKey = filtro.agentKey;
  if (filtro.status) where.status = filtro.status;
  if (filtro.tipo) where.tipo = filtro.tipo;
  if (filtro.desde) where.createdAt = { gte: filtro.desde };
  return (await db.agentChore.findMany({ where, orderBy: { createdAt: "desc" }, take: Math.min(filtro.take ?? 200, 1000) })) as ChoreRow[];
}

export async function cursorDe(db: ChoreDb, fonteHash: string): Promise<ChoreCursorRow | null> {
  return (await db.choreCursor.findUnique({ where: { fonteHash } })) as ChoreCursorRow | null;
}

/** Chores concluídas hoje neste canal (teto CHORE_POSTS_DIA — conta done do dia, como no contrato). */
export async function postsHoje(db: ChoreDb, canalId: string, agora = new Date()): Promise<number> {
  const inicio = new Date(`${diaDe(agora)}T00:00:00.000Z`);
  return db.agentChore.count({ where: { canalId, status: "done", updatedAt: { gte: inicio } } }).catch(() => 0);
}
