/**
 * scripts/atlas-rag-indexes.mongo.js — índices Atlas Search da base RAG por turma/aluno (F1).
 *
 * Sem eles a busca de `lib/rag/busca.ts` falha ("index not found"). Contrato (fonte-da-verdade = busca.ts):
 *   coleção      : rag_trechos
 *   VEC_INDEX    : "rag_trechos_vec"   · $vectorSearch { index, path:"embedding", filter: filtroVetorial }
 *   TEXT_INDEX   : "rag_trechos_text"  · $search { index, compound:{ must:[text path:"texto"], filter:[turmaIds/donoIds] } }
 *   EMBED_DIM    : 1024                · gemini-embedding-001 (Vertex), similarity cosine
 *   permissão    : turmaIds / donoIds como `filter` (vetor) e `token` (texto) — o filtro roda DENTRO do índice.
 *
 * USO (mongosh apontado pro cluster de PROD):
 *   mongosh "<ATLAS_SRV_URI>/<DB>" scripts/atlas-rag-indexes.mongo.js
 * Ambos ficam Active/queryable em ~1-2 min. Idempotente: pula o que já existe.
 */

const COLLECTION = "rag_trechos";
const VECTOR_INDEX = "rag_trechos_vec";
const TEXT_INDEX = "rag_trechos_text";
const EMBED_DIM = 1024;

const col = db.getCollection(COLLECTION);

// Garante a coleção (o createSearchIndex exige que ela exista; `prisma db push` também a cria).
const names = db.getCollectionNames();
if (!names.includes(COLLECTION)) {
  print(`• coleção ${COLLECTION} ausente → criando`);
  db.createCollection(COLLECTION);
}

// Índices já presentes (evita erro de duplicado em re-runs).
const existing = new Set(col.getSearchIndexes().map((ix) => ix.name));

// ── Índice vetorial (ANN sobre embedding, cosine, filtros de permissão) ──
if (existing.has(VECTOR_INDEX)) {
  print(`✓ ${VECTOR_INDEX} já existe — pulando`);
} else {
  col.createSearchIndex(VECTOR_INDEX, "vectorSearch", {
    fields: [
      { type: "vector", path: "embedding", numDimensions: EMBED_DIM, similarity: "cosine" },
      { type: "filter", path: "turmaIds" },
      { type: "filter", path: "donoIds" },
    ],
  });
  print(`+ criado ${VECTOR_INDEX} (vectorSearch, ${EMBED_DIM}d cosine, filter turmaIds/donoIds)`);
}

// ── Índice de texto (ramo $search do $rankFusion; português, permissão como token) ──
if (existing.has(TEXT_INDEX)) {
  print(`✓ ${TEXT_INDEX} já existe — pulando`);
} else {
  col.createSearchIndex(TEXT_INDEX, "search", {
    mappings: {
      dynamic: false,
      fields: {
        texto: { type: "string", analyzer: "lucene.portuguese" },
        turmaIds: { type: "token" },
        donoIds: { type: "token" },
      },
    },
  });
  print(`+ criado ${TEXT_INDEX} ($search sobre texto lucene.portuguese; turmaIds/donoIds token)`);
}

// ── Status (queryable=true quando ficam Active, ~1-2 min) ──
print("\n— status dos índices (repita até queryable:true) —");
printjson(
  col.getSearchIndexes().map((ix) => ({ name: ix.name, type: ix.type, status: ix.status, queryable: ix.queryable })),
);
