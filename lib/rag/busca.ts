/**
 * lib/rag/busca.ts — busca híbrida (vetor + texto) na base RAG, com a PERMISSÃO dentro do filtro.
 *
 * `$rankFusion` (MongoDB 8.0 / Atlas) funde o ramo `$vectorSearch` e o ramo `$search` (lucene.portuguese).
 * O filtro de turma/dono vai DENTRO dos dois ramos (nunca depois); em cima disso o resultado ainda passa por
 * `podeVer` (cinto + suspensório). Forma verificada no cluster de produção em 2026-10-21:
 * `{ $rankFusion: { input: { pipelines: { <nome>: [ ...estágios ] } } } }`, com `$vectorSearch`/`$search`
 * como PRIMEIRO estágio do respectivo sub-pipeline; score lido depois com `{ $meta: "score" }`.
 *
 * Falha do embedder (erro ou prazo) NUNCA derruba a busca: cai para só texto. Falha do aggregate propaga.
 */
import type { EmbedRag } from "./embed";
import { filtroTextual, filtroVetorial, podeVer, temBase, type EscopoRag } from "./permissao";

export const VEC_INDEX = "rag_trechos_vec";
export const TEXT_INDEX = "rag_trechos_text";
export const K_PADRAO = 8;
const PRAZO_EMBED_PADRAO_MS = 3000;

export type TrechoAchado = {
  trechoId: string;
  documentoId: string;
  titulo: string;
  texto: string;
  paginaIni: number;
  paginaFim: number;
  score: number;
};

export type BuscaDeps = {
  colecao: { aggregate(pipeline: unknown[]): Promise<any[]> };
  embed: EmbedRag;
  contar: (e: EscopoRag) => Promise<{ pessoais: number; deTurma: number }>;
  /** Prazo do embed da pergunta; estourou/falhou ⇒ só texto. Padrão 3000 ms. */
  prazoEmbedMs?: number;
};

/** Pipeline da busca. Com `vetor`: `$rankFusion` (vetor + texto); sem: só o ramo texto. */
export function montarPipeline(e: EscopoRag, pergunta: string, vetor: number[] | null, k: number): unknown[] {
  const ramoTexto: unknown[] = [
    {
      $search: {
        index: TEXT_INDEX,
        // A permissão é cláusula OBRIGATÓRIA (filter), nunca `should` (que só pontua).
        compound: { must: [{ text: { query: pergunta, path: "texto" } }], filter: filtroTextual(e) },
      },
    },
    { $limit: k },
  ];

  const inicio: unknown[] = vetor
    ? [
        {
          $rankFusion: {
            input: {
              pipelines: {
                vector: [
                  {
                    $vectorSearch: {
                      index: VEC_INDEX,
                      path: "embedding",
                      queryVector: vetor,
                      numCandidates: Math.max(100, k * 12),
                      limit: k,
                      filter: filtroVetorial(e),
                    },
                  },
                ],
                texto: ramoTexto,
              },
            },
          },
        },
        { $addFields: { score: { $meta: "score" } } },
      ]
    : [...ramoTexto, { $addFields: { score: { $meta: "searchScore" } } }];

  return [
    ...inicio,
    { $limit: k },
    { $lookup: { from: "rag_documentos", localField: "documentoId", foreignField: "_id", as: "doc" } },
    {
      $project: {
        _id: 1,
        documentoId: 1,
        texto: 1,
        paginaIni: 1,
        paginaFim: 1,
        score: 1,
        turmaIds: 1,
        donoIds: 1,
        titulo: { $ifNull: [{ $arrayElemAt: ["$doc.titulo", 0] }, ""] },
      },
    },
  ];
}

/** ObjectId pode chegar como string, como `{ $oid }` (extended JSON do `$runCommandRaw`) ou com `toString`. */
function idStr(v: unknown): string {
  if (v && typeof v === "object" && "$oid" in (v as Record<string, unknown>)) return String((v as { $oid: unknown }).$oid);
  return String(v ?? "");
}

/** Número do extended JSON do `$runCommandRaw`: `{ $numberDouble|$numberInt|$numberLong: "..." }` ou número/string simples. */
function num(v: unknown): number {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const bruto = o.$numberDouble ?? o.$numberInt ?? o.$numberLong ?? o.$numberDecimal;
    if (bruto !== undefined) {
      const n = Number(bruto);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Embed da pergunta com prazo; qualquer falha/estouro ⇒ null. O timer é sempre limpo. */
async function vetorDaPergunta(embed: EmbedRag, pergunta: string, prazoMs: number): Promise<number[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn("[rag/busca] embed falhou, seguindo só por palavra-chave:", `prazo de ${prazoMs} ms estourado`);
      resolve(null);
    }, prazoMs);
  });
  const chamada = (async () => {
    const [v] = await embed([pergunta], "pergunta");
    return Array.isArray(v) && v.length > 0 ? v : null;
  })().catch((e) => {
    console.warn("[rag/busca] embed falhou, seguindo só por palavra-chave:", (e as Error)?.message ?? e);
    return null;
  }); // rejeição tardia (depois do prazo) não vira unhandledRejection
  try {
    return await Promise.race([chamada, prazo]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function buscar(deps: BuscaDeps, e: EscopoRag, pergunta: string, k: number = K_PADRAO): Promise<TrechoAchado[]> {
  // userId vazio casaria com entradas "" em donoIds: sem identidade não há escopo.
  if (!e.userId || e.userId.trim() === "") return [];
  const consulta = pergunta.trim();
  if (!consulta) return [];
  if (!temBase(e, await deps.contar(e))) return [];

  const vetor = await vetorDaPergunta(deps.embed, consulta, deps.prazoEmbedMs ?? PRAZO_EMBED_PADRAO_MS);
  const brutos = await deps.colecao.aggregate(montarPipeline(e, consulta, vetor, k));

  return brutos
    .filter((t) => podeVer({ turmaIds: t.turmaIds ?? [], donoIds: t.donoIds ?? [] }, e))
    .map((t) => ({
      trechoId: idStr(t._id ?? t.trechoId),
      documentoId: idStr(t.documentoId),
      titulo: String(t.titulo ?? ""),
      texto: String(t.texto ?? ""),
      paginaIni: num(t.paginaIni),
      paginaFim: num(t.paginaFim),
      score: num(t.score),
    }));
}

/**
 * Coleção real: aggregate em `rag_trechos` via Prisma (Mongo). Sem teste contra cluster vivo aqui
 * (os índices `rag_trechos_vec`/`rag_trechos_text` vêm de `scripts/atlas-rag-indexes.mongo.js`).
 */
export function colecaoRagPrisma(prisma: { $runCommandRaw: (cmd: any) => Promise<any> }): BuscaDeps["colecao"] {
  return {
    async aggregate(pipeline) {
      const r = await prisma.$runCommandRaw({ aggregate: "rag_trechos", pipeline, cursor: {} });
      return (r?.cursor?.firstBatch ?? []) as any[];
    },
  };
}
