/**
 * VÍDEO DO DOCUMENTO — o servidor: o TEXTO do documento, a FILA com teto e o `garantirVideo` (um vídeo por documento).
 *
 * - Texto: artigo/livro pela leitura do scholar (PDF aberto → pdf-loader; senão o texto completo/abstract — abstract só
 *   não basta); base da pessoa pelo markdown guardado no RAG; trabalho pelo conteúdo do ResearchWork dela. Sem texto
 *   aberto = sem vídeo (o artefato fica `error` com o motivo — o card mostra).
 * - Fila: no máximo 2 gerando ao mesmo tempo (o Vertex já deu 429 aqui) e 6 vídeos novos por pessoa por dia.
 * - Um vídeo por documento: a CHAVE (lib/videodoc/documentos) vai em `StudioArtifact.sourceIds`; documento PÚBLICO
 *   (DOI/URL) reaproveita o vídeo de qualquer pessoa; o da pessoa (base, trabalho) é só dela. Quem pode ver: o dono, todo
 *   mundo se for público, ou quem tem papel num blueprint listado em `meta.blueprints`.
 */
import type { Documento } from "@/lib/blueprint/tipos";
import { chaveDocumento, documentoPublico } from "./documentos";
import { depsReais, gerarVideoDoc, type MetaVideoDoc } from "./gerar-server";

export const videoDocOn = (): boolean => process.env.VIDEO_DOC === "1";
export const KIND_VIDEO_DOC = "video-doc";
export const MAX_SIMULTANEOS = 2, MAX_POR_DIA = 6, MIN_TEXTO = 1500;

// ───────────── a fila (no processo do server.js, como o vídeo do Studio) ─────────────
let rodando = 0; const espera: (() => void)[] = [];
export async function naFila<T>(tarefa: () => Promise<T>): Promise<T> {
  if (rodando >= MAX_SIMULTANEOS) await new Promise<void>((r) => espera.push(r));
  rodando++;
  try { return await tarefa(); } finally { rodando--; espera.shift()?.(); }
}

// ───────────── o texto ─────────────
const juntar = (ps: { text: string }[]) => ps.map((p) => p.text).join("\n");
export async function textoDoDocumento(d: Documento, userId: string): Promise<string | null> {
  try {
    if (d.tipo === "trabalho" && d.ref) {
      const { prisma } = await import("@/src/lib/prisma");
      const w = /^[a-f0-9]{24}$/i.test(d.ref) ? await prisma.researchWork.findFirst({ where: { id: d.ref, userId }, select: { content: true } }) : null;
      return w?.content && w.content.length >= MIN_TEXTO ? w.content : null;
    }
    if (d.tipo === "base" && d.ref) {
      const [{ ragPg }, { buscarPorId }] = await Promise.all([import("@/lib/rag/pg"), import("@/lib/rag/store")]);
      const doc = await buscarPorId(ragPg(), d.ref);
      return doc?.markdown && doc.markdown.length >= MIN_TEXTO ? doc.markdown : null;
    }
    if (!d.url) return null;
    const { resolveFullText } = await import("@/lib/scholar/fulltext");
    const chave = chaveDocumento(d), doi = chave.startsWith("doi:") ? chave.slice(4) : undefined;
    const p = await resolveFullText({ id: chave, title: d.titulo, authors: [], doi, url: d.url, pdfUrl: /\.pdf($|[?#])/i.test(d.url) ? d.url : undefined, openAccess: false, sources: [] });
    const rt = p.retrievedText;
    if (!rt || rt.kind === "abstract") return null;
    const texto = rt.markdown || juntar(rt.paragraphs);
    return texto.length >= MIN_TEXTO ? texto : null;
  } catch { return null; }
}

// ───────────── um vídeo por documento ─────────────
type Art = { id: string; ownerId: string; status: string; meta: unknown; createdAt: Date };
export type VideoDb = {
  studioArtifact: {
    findFirst(a: { where: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> }): Promise<Art | null>;
    count(a: { where: Record<string, unknown> }): Promise<number>;
    create(a: { data: Record<string, unknown> }): Promise<Art>;
    update(a: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
};
export type GarantirDeps = { db?: VideoDb; texto?: typeof textoDoDocumento; gerar?: (artId: string, titulo: string, texto: string, meta: MetaVideoDoc, userId: string) => Promise<unknown>; agora?: number };

const inicioDoDia = (agora: number) => { const d = new Date(agora); d.setHours(0, 0, 0, 0); return d; };
const ERRO_RETENTA_MS = 24 * 3600 * 1000;

export type ResultadoGarantir = { videoId: string; novo: boolean } | { motivo: "limite_do_dia" };

export async function garantirVideo(i: { userId: string; documento: Documento; blueprintId: string } & GarantirDeps): Promise<ResultadoGarantir> {
  const db = i.db ?? ((await import("@/src/lib/prisma")).prisma as unknown as VideoDb);
  const agora = i.agora ?? Date.now(), chave = chaveDocumento(i.documento), publico = documentoPublico(i.documento);
  const ja = await db.studioArtifact.findFirst({ where: { kind: KIND_VIDEO_DOC, sourceIds: { has: chave }, ...(publico ? {} : { ownerId: i.userId }) }, orderBy: { createdAt: "desc" } });
  const velhoComErro = ja && ja.status === "error" && agora - ja.createdAt.getTime() > ERRO_RETENTA_MS;
  if (ja && !velhoComErro) {
    // o blueprint passa a poder ver o vídeo (compartilhado ou do mesmo dono)
    const meta = (ja.meta ?? {}) as MetaVideoDoc;
    if (!meta.blueprints?.includes(i.blueprintId)) await db.studioArtifact.update({ where: { id: ja.id }, data: { meta: { ...meta, blueprints: [...(meta.blueprints ?? []), i.blueprintId].slice(-50) } } });
    return { videoId: ja.id, novo: false };
  }
  const hoje = await db.studioArtifact.count({ where: { ownerId: i.userId, kind: KIND_VIDEO_DOC, createdAt: { gte: inicioDoDia(agora) } } });
  if (hoje >= MAX_POR_DIA) return { motivo: "limite_do_dia" };
  const meta: MetaVideoDoc = { chave, publico, blueprints: [i.blueprintId], documento: { titulo: i.documento.titulo, tipo: i.documento.tipo, ...(i.documento.url ? { url: i.documento.url } : {}) } };
  const art = await db.studioArtifact.create({ data: { ownerId: i.userId, kind: KIND_VIDEO_DOC, status: "queued", title: i.documento.titulo.slice(0, 200), sourceIds: [chave], meta } });
  const doc = i.documento, userId = i.userId;
  const gerar = i.gerar ?? (async (artId: string, titulo: string, texto: string, m: MetaVideoDoc, uid: string) => gerarVideoDoc(artId, { titulo, texto, meta: m }, await depsReais(uid)));
  // em segundo plano: o texto (pode demorar — PDF) e a geração, dentro da fila
  void naFila(async () => {
    const texto = await (i.texto ?? textoDoDocumento)(doc, userId);
    if (!texto) { await db.studioArtifact.update({ where: { id: art.id }, data: { status: "error", error: "sem_texto" } }); return; }
    await gerar(art.id, doc.titulo, texto, meta, userId);
  }).catch((e) => console.warn("[videodoc] geração falhou:", e instanceof Error ? e.message : e));
  return { videoId: art.id, novo: true };
}

/** quem pode ver o vídeo (PURO): o dono, qualquer pessoa logada se é público, ou quem tem papel num dos blueprints */
export function podeVerVideo(art: { ownerId: string; meta: unknown }, userId: string, blueprintsComPapel: readonly string[]): boolean {
  if (art.ownerId === userId) return true;
  const m = (art.meta ?? {}) as Partial<MetaVideoDoc>;
  if (m.publico) return true;
  return (m.blueprints ?? []).some((b) => blueprintsComPapel.includes(b));
}
