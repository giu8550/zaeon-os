/**
 * lib/agent/memory.ts — CONTRATO da memória semântica da Zaeon (camada L3 do
 * docs/MEMORY_AND_PERSISTENCE.md). Mecanismo roubado do MemPalace (verbatim +
 * recall-por-embedding-barato + hierarquia wing/room/drawer + write-no-finalize),
 * implementado NATIVO no Next/Mongo (Atlas Vector Search). É STANDARD — toda conta
 * tem memória; nenhum gate de plano aqui.
 *
 * Este arquivo é provider-agnóstico DE PROPÓSITO: as dependências de I/O (coleção
 * Mongo, função de embedding) são INJETADAS via `MemoryDeps`. Isso deixa o contrato
 * (1) testável sem banco, (2) transpilável sem puxar mongodb/@google-cloud, e (3)
 * documenta exatamente onde o executor pluga a infra. Prior-art: o RagBackend do
 * agent-gateway (owner_id sempre no filtro; embed com output_dimensionality).
 *
 * Wiring (PR-M3): `createMongoMemory({ drawers, embed })` onde `drawers` é a coleção
 * `memory_drawers` e `embed` chama gemini-embedding-001. `search` usa o estágio
 * `$vectorSearch` do Atlas com `filter: { userId }`. Ver §4.3/§6 do doc.
 */

// ───────────────────────────── Tipos do palácio ─────────────────────────────

/** Dimensão do vetor. gemini-embedding-001 suporta output_dimensionality; fixamos 1536
 *  (igual ao agent-gateway) — trocar para 768 se migrar p/ embeddinggemma-300m. */
export const EMBED_DIM = 1536;
/** k padrão do recall (top-k drawers). Barato: é ANN, sem LLM. */
export const DEFAULT_K = 8;
/** Nome do índice Atlas Vector Search sobre memory_drawers.embedding (cosine, filter userId). */
export const VECTOR_INDEX = "memory_drawers_vec";

export type WingKind = "usuario" | "curso" | "projeto" | "agente";
export type DrawerKind = "mensagem" | "citacao" | "artefato" | "nota";

/** Wing = o "andar" (a quem/ao quê a memória pertence). Deriva de surface/scopeId/curso. */
export type Wing = { kind: WingKind; label: string };
/** Room = o cômodo (tópico/matéria). */
export type Room = string;

/** Drawer = a gaveta: um trecho VERBATIM recuperável. É uma projeção indexada do L1. */
export type Drawer = {
  id?: string;
  userId: string;              // isolamento multi-tenant — SEMPRE no filtro
  wing: Wing;
  room: Room;
  kind: DrawerKind;
  text: string;                // literal, nunca resumido por LLM
  sourceRef?: string;          // conversationId/messageId/studyId de origem (L1)
  embedding?: number[];        // preenchido no write; comprimento = EMBED_DIM
  meta?: Record<string, unknown>;  // provenance
  at?: string;                 // ISO
  // curadoria + re-rank (A7/A9) — projeção dos campos do model MemoryDrawer.
  importance?: number;         // peso relativo (curadoria)
  lastAccessedAt?: string;     // recency: bump a cada hit; decay no re-rank
  accessCount?: number;
  invalidatedAt?: string | null; // SUPERSEDE: aposentado → nunca entra no recall
  supersededBy?: string;       // id do drawer que o substituiu
};

/** Escopo do recall: restringe a busca (estreita o espaço → mais barato e preciso). */
export type MemoryScope = {
  userId: string;              // obrigatório: nunca cruza usuários
  wingKind?: WingKind;
  wingLabel?: string;
  room?: Room;
};

export type RecallHit = Drawer & { score: number };

// ───────────────────────────── A API pública ─────────────────────────────

export interface MemoryAPI {
  /** Recall relevante no INÍCIO da sessão → injeta no AgentContext (L2). Barato (ANN, sem LLM). */
  wakeUp(scope: MemoryScope, hint?: string, k?: number): Promise<RecallHit[]>;
  /** Busca semântica — é a tool `memory_search`. FILTRA por userId (e escopo, se dado). */
  search(query: string, scope: MemoryScope, k?: number): Promise<RecallHit[]>;
  /** Persistência no `finalize` da trajetória: drawers verbatim + embedding + provenance. */
  write(drawers: Drawer[]): Promise<void>;
}

// ───────────────────── Deps injetadas (onde a infra pluga) ─────────────────────

/** Uma coleção estilo-Mongo, mínima o suficiente pro contrato (o executor passa a real). */
export interface DrawerCollection {
  /** Recebe docs FLAT (batem com o model MemoryDrawer: wingKind/wingLabel). */
  insertMany(docs: Record<string, unknown>[]): Promise<unknown>;
  /** Executa um pipeline de agregação ($vectorSearch/$search/$rankFusion + $project). */
  aggregate(pipeline: unknown[]): Promise<RecallHit[]>;
  /** Atualiza drawers (bump de recency; SUPERSEDE seta invalidatedAt/supersededBy). Opcional. */
  updateMany?(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<unknown>;
}

export type EmbedFn = (texts: string[], dim?: number) => Promise<number[][]>;

/** A operação da curadoria (A7). O modelo decide SÓ a operação — nunca reescreve o texto. */
export type CurationOp = { type: "ADD" } | { type: "NOOP" } | { type: "SUPERSEDE"; targetId: string };
/** Decisor de curadoria: dado o candidato e os top-k similares, devolve a operação. */
export type CurateFn = (candidate: Drawer, similars: RecallHit[]) => Promise<CurationOp> | CurationOp;

export type MemoryDeps = {
  drawers: DrawerCollection;   // coleção memory_drawers
  embed: EmbedFn;              // gemini-embedding-001 (output_dimensionality = dim)
  supportsRankFusion?: boolean; // cluster ≥ 8.1 → $rankFusion nativo; senão RRF app-side (A9)
  curate?: CurateFn;           // curadoria no write (default: heurística sem LLM)
  halfLifeHours?: number;      // meia-vida do decay de recency no re-rank (default 72h)
};

// ─────────────── Helpers de derivação (L1/artefato → Drawer) ───────────────

/** Deriva o Wing a partir da superfície/curso da conversa (L1). */
export function wingFromSurface(surface: string, opts?: { course?: string; projectId?: string }): Wing {
  if (opts?.course) return { kind: "curso", label: opts.course };
  if (opts?.projectId) return { kind: "projeto", label: opts.projectId };
  return { kind: "usuario", label: surface || "geral" };
}

/** Filtra o que MERECE virar memória (evita poluir com "ok", "obrigado", etc.). */
export function isMemorable(text: string, kind: DrawerKind): boolean {
  if (kind === "citacao" || kind === "artefato") return true;   // sempre guarda
  const t = text.trim();
  return t.length >= 40;                                          // mensagem/nota: só se tiver substância
}

// ───────────────────── Fusão + re-rank (puros, testáveis) ─────────────────────

/** id estável de um drawer p/ dedup na fusão (id do banco, senão o próprio texto). */
const drawerKey = (d: Drawer): string => d.id || d.sourceRef || d.text;

/**
 * Reciprocal Rank Fusion (A9, fallback app-side). Funde N listas ranqueadas: cada item soma
 * `1/(k + rank)` por lista em que aparece (k=60, padrão da literatura). Dedup por drawerKey.
 * Não usa LLM. Mantém o melhor snapshot de cada drawer.
 */
export function rrfFuse(lists: RecallHit[][], k = 60): RecallHit[] {
  const acc = new Map<string, { hit: RecallHit; score: number }>();
  for (const list of lists) {
    list.forEach((hit, rank) => {
      const key = drawerKey(hit);
      const inc = 1 / (k + rank + 1);
      const cur = acc.get(key);
      if (cur) cur.score += inc;
      else acc.set(key, { hit, score: inc });
    });
  }
  return [...acc.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ hit, score }) => ({ ...hit, score }));
}

/** horas desde um ISO (ou +∞ se ausente → decay máximo). */
function hoursSince(iso: string | null | undefined, now: number): number {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Infinity : Math.max(0, (now - t) / 3_600_000);
}

/**
 * Re-rank final (A9): `base × exp(-λ·horasDesde(lastAccessedAt)) × pesoImportance`.
 * λ vem da meia-vida (halfLifeHours). pesoImportance = 1 + importance/10 (clamp ≥ 0.1).
 * Recency ausente → decay total (drawer frio pesa menos, mas não some). Puro, sem LLM.
 */
export function reRank(hits: RecallHit[], opts: { now: number; halfLifeHours?: number }): RecallHit[] {
  const halfLife = opts.halfLifeHours ?? 72;
  const lambda = Math.LN2 / halfLife;
  return hits
    .map((h) => {
      // nunca acessado → usa `at` (criação); drawer fresco pesa alto, não zera.
      const recency = Math.exp(-lambda * hoursSince(h.lastAccessedAt ?? h.at, opts.now));
      const importanceW = Math.max(0.1, 1 + (h.importance ?? 0) / 10);
      return { ...h, score: (h.score || 0) * recency * importanceW };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Curadoria heurística (A7, default sem LLM): se já existe um drawer quase idêntico (score alto),
 * NOOP (não duplica); senão ADD. SUPERSEDE fica a cargo do decisor LLM (nunca da heurística).
 */
export function decideCurationHeuristic(candidate: Drawer, similars: RecallHit[]): CurationOp {
  const top = similars[0];
  if (top && (top.score ?? 0) >= 0.97) return { type: "NOOP" };
  if (top && top.text.trim() === candidate.text.trim()) return { type: "NOOP" };
  return { type: "ADD" };
}

// ───────────────────── Implementação nativa (Atlas Vector) ─────────────────────

/** Nome do índice de texto (Atlas $search) — usado no ramo RRF app-side. */
export const TEXT_INDEX = "memory_drawers_text";

/** Docs são FLAT (batem com o model MemoryDrawer); o $project reconstrói `wing` aninhado. */
function projectStage(scoreMeta: string) {
  return {
    $project: {
      userId: 1, room: 1, kind: 1, text: 1, sourceRef: 1, meta: 1, at: 1,
      importance: 1, lastAccessedAt: 1, accessCount: 1, invalidatedAt: 1, supersededBy: 1,
      wing: { kind: "$wingKind", label: "$wingLabel" },
      score: { $meta: scoreMeta },
    },
  };
}

/**
 * Fábrica da MemoryAPI nativa. O executor chama isto com a coleção real e o embed real.
 * Owner isolation (userId + invalidatedAt:null no filtro SEMPRE), verbatim na escrita, recall
 * HÍBRIDO barato (ANN + texto, sem LLM), re-rank por recency×importância e curadoria no write.
 */
export function createMongoMemory(deps: MemoryDeps): MemoryAPI {
  const { drawers, embed } = deps;

  function baseFilter(scope: MemoryScope): Record<string, unknown> {
    const f: Record<string, unknown> = { userId: scope.userId, invalidatedAt: null };
    if (scope.wingKind) f.wingKind = scope.wingKind;
    if (scope.wingLabel) f.wingLabel = scope.wingLabel;
    if (scope.room) f.room = scope.room;
    return f;
  }

  const vectorPipeline = (qv: number[], filter: Record<string, unknown>, k: number) => [
    { $vectorSearch: { index: VECTOR_INDEX, path: "embedding", queryVector: qv, numCandidates: Math.max(100, k * 12), limit: k, filter } },
    projectStage("vectorSearchScore"),
  ];
  const textPipeline = (query: string, filter: Record<string, unknown>, k: number) => [
    { $search: { index: TEXT_INDEX, text: { query, path: ["text", "room", "wingLabel"] } } },
    { $match: filter },
    { $limit: k },
    projectStage("searchScore"),
  ];
  const rankFusionPipeline = (qv: number[], query: string, filter: Record<string, unknown>, k: number) => [
    {
      $rankFusion: {
        input: {
          pipelines: {
            vector: [{ $vectorSearch: { index: VECTOR_INDEX, path: "embedding", queryVector: qv, numCandidates: Math.max(100, k * 12), limit: k, filter } }],
            text: [{ $search: { index: TEXT_INDEX, text: { query, path: ["text", "room"] } } }, { $match: filter }, { $limit: k }],
          },
        },
        combination: { weights: { vector: 0.7, text: 0.3 } },
      },
    },
    { $limit: k },
    projectStage("score"),
  ];

  async function bump(hits: RecallHit[]): Promise<void> {
    if (!drawers.updateMany) return;
    const ids = hits.map((h) => h.id).filter((x): x is string => !!x);
    if (!ids.length) return;
    await drawers.updateMany(
      { _id: { $in: ids } },
      { $set: { lastAccessedAt: new Date().toISOString() }, $inc: { accessCount: 1 } },
    );
  }

  // Busca vetorial CRUA (score = cosine, sem fusão/rerank/bump) — usada pela curadoria,
  // que precisa da similaridade real, não do score fundido do RRF.
  async function vectorOnly(queryText: string, scope: MemoryScope, k: number): Promise<RecallHit[]> {
    if (!scope.userId) return [];
    try {
      const [qv] = await embed([queryText], EMBED_DIM);
      return await drawers.aggregate(vectorPipeline(qv, baseFilter(scope), k));
    } catch {
      return [];
    }
  }

  async function recall(queryText: string, scope: MemoryScope, k = DEFAULT_K, doBump = true): Promise<RecallHit[]> {
    if (!scope.userId) return []; // guarda-corpo: NUNCA busca sem dono
    let hits: RecallHit[] = [];
    try {
      const [qv] = await embed([queryText], EMBED_DIM);
      const filter = baseFilter(scope);
      if (deps.supportsRankFusion) {
        hits = await drawers.aggregate(rankFusionPipeline(qv, queryText, filter, k)); // A9 nativo
      } else {
        // RRF app-side: vetor (sempre) + texto (best-effort — sem índice de texto, ignora).
        const [vec, txt] = await Promise.all([
          drawers.aggregate(vectorPipeline(qv, filter, k)),
          Promise.resolve().then(() => drawers.aggregate(textPipeline(queryText, filter, k))).catch(() => [] as RecallHit[]),
        ]);
        hits = rrfFuse([vec, txt], 60).slice(0, k);
      }
    } catch {
      return []; // escada de degradação: Atlas fora do ar → recall vazio (chat segue limpo)
    }
    const ranked = reRank(hits, { now: Date.now(), halfLifeHours: deps.halfLifeHours }).slice(0, k);
    if (doBump) void bump(ranked).catch(() => {}); // best-effort; nunca derruba o recall
    return ranked;
  }

  return {
    wakeUp: (scope, hint, k) => recall(hint?.trim() || scope.room || scope.wingLabel || "", scope, k),
    search: (query, scope, k) => recall(query, scope, k),
    async write(items) {
      const keep = items.filter((d) => d.userId && isMemorable(d.text, d.kind));
      if (!keep.length) return;
      const curate = deps.curate ?? decideCurationHeuristic;
      const now = new Date().toISOString();
      const toInsert: Drawer[] = [];
      for (const cand of keep) {
        // top-k similares (similaridade CRUA) p/ a curadoria decidir a operação.
        const similars = await vectorOnly(cand.text, { userId: cand.userId, wingKind: cand.wing.kind, wingLabel: cand.wing.label }, 3);
        const op = await curate(cand, similars);
        if (op.type === "NOOP") continue;
        if (op.type === "SUPERSEDE" && drawers.updateMany) {
          // aposenta o antigo (nunca mais entra no recall) — o backlink `supersededBy` fica p/ o provider.
          await drawers.updateMany({ _id: op.targetId }, { $set: { invalidatedAt: now } }).catch(() => {});
        }
        toInsert.push(cand);
      }
      if (!toInsert.length) return;
      const vectors = await embed(toInsert.map((d) => d.text), EMBED_DIM); // verbatim → embedding
      await drawers.insertMany(
        toInsert.map((d, i) => ({
          userId: d.userId,
          wingKind: d.wing.kind,
          wingLabel: d.wing.label,
          room: d.room,
          kind: d.kind,
          text: d.text, // LITERAL — nunca resumido por LLM
          sourceRef: d.sourceRef ?? null,
          embedding: vectors[i],
          meta: d.meta ?? null,
          at: d.at || now,
          importance: d.importance ?? null,
          lastAccessedAt: null,
          accessCount: 0,
          invalidatedAt: null,
          supersededBy: null,
        })),
      );
    },
  };
}

/** No-op para quando a memória está desligada (flag off) — mantém as salas funcionando. */
export const nullMemory: MemoryAPI = {
  wakeUp: async () => [],
  search: async () => [],
  write: async () => {},
};
