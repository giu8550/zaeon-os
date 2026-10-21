/**
 * lib/rag/store.ts — persistência da base RAG (documentos + trechos) com `db` injetável.
 *
 * Permissões são `turmaIds` / `donoIds` (strings simples), gravadas no documento E copiadas em
 * cada trecho (o filtro do índice vetorial/textual olha o trecho). `RagTrecho` não tem relação
 * nem cascade no Prisma: TODA remoção de documento apaga os trechos explicitamente (`apagarDocumento`).
 */
import type { RagDocumento } from "@prisma/client";
import type { TrechoCortado } from "./corte";
import type { EscopoRag } from "./permissao";

export type RagDocumentoRow = RagDocumento;
/** Linha de listagem: sem o `markdown` (pesado). */
export type RagDocumentoLista = Omit<RagDocumentoRow, "markdown">;

/** O pedaço do Prisma que o store usa (injetável em teste). */
export type RagDb = {
  ragDocumento: {
    findUnique(a: { where: { id: string } | { hash: string } }): Promise<any | null>;
    create(a: { data: Record<string, unknown> }): Promise<any>;
    update(a: { where: { id: string }; data: Record<string, unknown> }): Promise<any>;
    findMany(a: { where?: Record<string, unknown>; select?: Record<string, boolean>; orderBy?: Record<string, unknown> }): Promise<any[]>;
    delete(a: { where: { id: string } }): Promise<any>;
    count(a: { where?: Record<string, unknown> }): Promise<number>;
  };
  ragTrecho: {
    createMany(a: { data: any[] }): Promise<{ count: number }>;
    updateMany(a: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
    findMany(a: { where?: Record<string, unknown>; select?: Record<string, boolean>; orderBy?: Record<string, unknown>; take?: number }): Promise<any[]>;
    deleteMany(a: { where: Record<string, unknown> }): Promise<{ count: number }>;
    update(a: { where: { id: string }; data: Record<string, unknown> }): Promise<any>;
  };
};

export type Permissao = { turmaId?: string; donoId?: string };

/** Ids de permissão são strings simples; vazio casaria com nada (ou tudo) — recusa. */
function validar(p: Permissao): void {
  if (p.turmaId === "" || p.donoId === "") throw new Error("permissão com id vazio");
  if (p.turmaId == null && p.donoId == null) throw new Error("permissão sem turmaId nem donoId");
}

export async function buscarPorHash(db: RagDb, hash: string): Promise<RagDocumentoRow | null> {
  return (await db.ragDocumento.findUnique({ where: { hash } })) as RagDocumentoRow | null;
}

export async function criarDocumento(
  db: RagDb,
  d: { hash: string; titulo: string; nomeArquivo: string; paginas: number; markdown: string; origem: string; criadoPor: string; permissao: Permissao },
): Promise<RagDocumentoRow> {
  validar(d.permissao);
  return (await db.ragDocumento.create({
    data: {
      hash: d.hash, titulo: d.titulo, nomeArquivo: d.nomeArquivo, paginas: d.paginas, markdown: d.markdown,
      status: "indexando", origem: d.origem, criadoPor: d.criadoPor,
      turmaIds: d.permissao.turmaId ? [d.permissao.turmaId] : [],
      donoIds: d.permissao.donoId ? [d.permissao.donoId] : [],
    },
  })) as RagDocumentoRow;
}

/** Grava os trechos (sem vetor ainda), copiando a permissão, e fixa `totalTrechos` no documento. */
export async function gravarTrechos(
  db: RagDb,
  documentoId: string,
  trechos: TrechoCortado[],
  perm: { turmaIds: string[]; donoIds: string[] },
): Promise<number> {
  if (trechos.length > 0) {
    await db.ragTrecho.createMany({
      data: trechos.map((t) => ({
        documentoId, ordem: t.ordem, texto: t.texto, caminho: t.caminho, paginaIni: t.paginaIni, paginaFim: t.paginaFim,
        // `embedding: []` explícito: no Mongo o campo precisa existir para `{ isEmpty: true }` casar.
        turmaIds: [...perm.turmaIds], donoIds: [...perm.donoIds], embedding: [],
      })),
    });
  }
  // A permissão do DOCUMENTO no momento da escrita manda: um `acrescentarPermissao` concorrente pode ter
  // rodado antes de existirem trechos (não os viu). Re-sincroniza os trechos com os arrays atuais do documento.
  const atual = await carregar(db, documentoId);
  await db.ragTrecho.updateMany({ where: { documentoId }, data: { turmaIds: [...atual.turmaIds], donoIds: [...atual.donoIds] } });
  await db.ragDocumento.update({ where: { id: documentoId }, data: { totalTrechos: trechos.length } });
  return trechos.length;
}

const sem = (xs: string[], x: string | undefined) => (x == null ? xs : xs.filter((y) => y !== x));
const com = (xs: string[], x: string | undefined) => (x == null || xs.includes(x) ? xs : [...xs, x]);

async function carregar(db: RagDb, documentoId: string): Promise<RagDocumentoRow> {
  const doc = (await db.ragDocumento.findUnique({ where: { id: documentoId } })) as RagDocumentoRow | null;
  if (!doc) throw new Error(`documento ${documentoId} não existe`);
  return doc;
}

/**
 * Ordem das escritas: na REMOÇÃO os trechos vão primeiro (é neles que o filtro do índice olha) — se a 2ª escrita
 * falhar, o acesso já foi cortado (falha fechada, sem vazamento entre turmas). Na INCLUSÃO, o documento primeiro
 * (se falhar no meio, o retry idempotente completa; ninguém ganha acesso a mais do que o documento declara).
 */
async function gravarPermissao(db: RagDb, documentoId: string, turmaIds: string[], donoIds: string[], remocao: boolean): Promise<void> {
  const docOp = () => db.ragDocumento.update({ where: { id: documentoId }, data: { turmaIds, donoIds } });
  const trechosOp = () => db.ragTrecho.updateMany({ where: { documentoId }, data: { turmaIds, donoIds } });
  if (remocao) { await trechosOp(); await docOp(); } else { await docOp(); await trechosOp(); }
}

/** Documento E todos os trechos. Idempotente (sem duplicata). */
export async function acrescentarPermissao(db: RagDb, documentoId: string, p: Permissao): Promise<void> {
  validar(p);
  const doc = await carregar(db, documentoId);
  await gravarPermissao(db, documentoId, com(doc.turmaIds, p.turmaId), com(doc.donoIds, p.donoId), false);
}

/** Remove uma permissão; se era a última, apaga o documento e os trechos. */
export async function removerPermissao(db: RagDb, documentoId: string, p: Permissao): Promise<"removida" | "documento_apagado"> {
  validar(p);
  const doc = await carregar(db, documentoId);
  const turmaIds = sem(doc.turmaIds, p.turmaId);
  const donoIds = sem(doc.donoIds, p.donoId);
  if (turmaIds.length === 0 && donoIds.length === 0) {
    await apagarDocumento(db, documentoId);
    return "documento_apagado";
  }
  await gravarPermissao(db, documentoId, turmaIds, donoIds, true);
  return "removida";
}

/** Apaga o documento e todos os seus trechos (trechos primeiro: se cair no meio, o retry ainda acha o documento). */
export async function apagarDocumento(db: RagDb, documentoId: string): Promise<void> {
  await db.ragTrecho.deleteMany({ where: { documentoId } });
  await db.ragDocumento.delete({ where: { id: documentoId } });
}

export async function marcarErro(db: RagDb, documentoId: string, erro: string): Promise<void> {
  await db.ragDocumento.update({ where: { id: documentoId }, data: { status: "erro", erro: String(erro).slice(0, 500) } });
}

/** Grava os vetores, recalcula `comVetor` e, quando todos os trechos têm vetor, vira "pronto". */
export async function registrarVetores(db: RagDb, documentoId: string, itens: { trechoId: string; embedding: number[] }[]): Promise<void> {
  for (const it of itens) {
    await db.ragTrecho.update({ where: { id: it.trechoId }, data: { embedding: it.embedding } });
  }
  const doc = await carregar(db, documentoId);
  const comVetor = (await db.ragTrecho.findMany({ where: { documentoId, embedding: { isEmpty: false } }, select: { id: true } })).length;
  const completo = doc.totalTrechos > 0 && comVetor >= doc.totalTrechos;
  await db.ragDocumento.update({
    where: { id: documentoId },
    data: { comVetor, ...(completo && doc.status === "indexando" ? { status: "pronto" } : {}) },
  });
}

export async function trechosSemVetor(db: RagDb, documentoId: string, limite: number): Promise<{ id: string; texto: string }[]> {
  const rows = await db.ragTrecho.findMany({
    where: { documentoId, embedding: { isEmpty: true } }, select: { id: true, texto: true }, orderBy: { ordem: "asc" }, take: limite,
  });
  return rows.map((r) => ({ id: String(r.id), texto: r.texto as string }));
}

const CAMPOS_LISTA = {
  id: true, hash: true, titulo: true, nomeArquivo: true, paginas: true, status: true, erro: true, turmaIds: true,
  donoIds: true, origem: true, criadoPor: true, totalTrechos: true, comVetor: true, createdAt: true, updatedAt: true,
};

/** Sem `markdown`. Turma e dono juntos => união (OU). Sem filtro => todos. */
export async function listarDocumentos(db: RagDb, f: { turmaId?: string; donoId?: string }): Promise<RagDocumentoLista[]> {
  const ou: Record<string, unknown>[] = [];
  if (f.turmaId) ou.push({ turmaIds: { has: f.turmaId } });
  if (f.donoId) ou.push({ donoIds: { has: f.donoId } });
  const where = ou.length === 0 ? {} : ou.length === 1 ? ou[0] : { OR: ou };
  return (await db.ragDocumento.findMany({ where, select: CAMPOS_LISTA, orderBy: { createdAt: "desc" } })) as RagDocumentoLista[];
}

/** Quantos documentos (não-erro) o escopo enxerga, separando pessoais de turma. */
export async function contarBase(db: RagDb, e: EscopoRag): Promise<{ pessoais: number; deTurma: number }> {
  const naoErro = { status: { not: "erro" } };
  const pessoais = await db.ragDocumento.count({ where: { ...naoErro, donoIds: { has: e.userId } } });
  const deTurma = e.turmaIds.length === 0 ? 0 : await db.ragDocumento.count({ where: { ...naoErro, turmaIds: { hasSome: e.turmaIds } } });
  return { pessoais, deTurma };
}
