/**
 * scripts/atlas-memory-indexes.mongo.js — cria os índices Atlas Search que a memória L3
 * precisa (PARTE 1 · P1.3 do MASTER_HARNESS_ACTIVATION / passo 4 do ACTIVATE_HARNESS_NOW).
 *
 * Sem esses índices, o recall degrada em SILÊNCIO ("index not found" engolido pelo laço).
 * Este script materializa o passo 🔒 manual (mongosh/Atlas UI) num artefato versionado e
 * REVISÁVEL, com os campos batendo com o agregado real de `lib/agent/memory.ts` — em vez
 * do snippet solto do runbook, que mapeava só { text, userId } e deixava o ramo de texto
 * cego para `room`/`wingLabel` (que o `$search` de fato consulta).
 *
 * Contrato (fonte-da-verdade = lib/agent/memory.ts):
 *   coleção      : memory_drawers            (MemoryDeps.drawers)
 *   VECTOR_INDEX : "memory_drawers_vec"      · $vectorSearch { index, path:"embedding", filter }
 *   TEXT_INDEX   : "memory_drawers_text"     · $search { index, text:{ path:["text","room","wingLabel"] } }
 *   EMBED_DIM    : 1536                       · gemini-embedding-001, similarity cosine
 *   filtro       : { userId, invalidatedAt } — aplicado como estágio $match (não precisa índice),
 *                  mas userId vai como `token` no índice de texto p/ paridade de escopo.
 *
 * Docs são gravados FLAT (memory.ts §insertMany → wingKind/wingLabel/room no topo do doc),
 * então os paths do índice de texto são de 1º nível.
 *
 * USO (mongosh apontado pro cluster de PROD):
 *   mongosh "<ATLAS_SRV_URI>/<DB>" scripts/atlas-memory-indexes.mongo.js
 * ou cole os dois createSearchIndex no Atlas UI → Search → Create Index → JSON Editor.
 * Ambos ficam Active/queryable em ~1-2 min. Idempotente: pula o que já existe.
 */

const COLLECTION = "memory_drawers";
const VECTOR_INDEX = "memory_drawers_vec";
const TEXT_INDEX = "memory_drawers_text";
const EMBED_DIM = 1536;

const col = db.getCollection(COLLECTION);

// Garante a coleção (o createSearchIndex exige que ela exista; `prisma db push` também a cria).
const names = db.getCollectionNames();
if (!names.includes(COLLECTION)) {
  print(`• coleção ${COLLECTION} ausente → criando`);
  db.createCollection(COLLECTION);
}

// Índices já presentes (evita erro de duplicado em re-runs).
const existing = new Set(col.getSearchIndexes().map((ix) => ix.name));

// ── Índice vetorial (ANN sobre embedding, cosine, filtro por userId) ──
if (existing.has(VECTOR_INDEX)) {
  print(`✓ ${VECTOR_INDEX} já existe — pulando`);
} else {
  col.createSearchIndex(VECTOR_INDEX, "vectorSearch", {
    fields: [
      { type: "vector", path: "embedding", numDimensions: EMBED_DIM, similarity: "cosine" },
      { type: "filter", path: "userId" },
    ],
  });
  print(`+ criado ${VECTOR_INDEX} (vectorSearch, ${EMBED_DIM}d cosine, filter userId)`);
}

// ── Índice de texto (ramo $search / $rankFusion do recall híbrido) ──
// path do $search em memory.ts: ["text","room","wingLabel"] → TODOS precisam estar mapeados
// (dynamic:false não indexa campo não-declarado). userId como token p/ escopo/paridade.
if (existing.has(TEXT_INDEX)) {
  print(`✓ ${TEXT_INDEX} já existe — pulando`);
} else {
  col.createSearchIndex(TEXT_INDEX, {
    mappings: {
      dynamic: false,
      fields: {
        text: { type: "string" },
        room: { type: "string" },
        wingLabel: { type: "string" },
        userId: { type: "token" },
      },
    },
  });
  print(`+ criado ${TEXT_INDEX} ($search sobre text/room/wingLabel; userId token)`);
}

// ── Status (queryable=true quando ficam Active, ~1-2 min) ──
print("\n— status dos índices (repita até queryable:true) —");
printjson(
  col.getSearchIndexes().map((ix) => ({ name: ix.name, type: ix.type, status: ix.status, queryable: ix.queryable })),
);
