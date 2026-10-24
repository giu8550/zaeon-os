/**
 * lib/agent/memory-provider.ts — o SEAM de infra da memória L3 (PR-M3 · wiring).
 *
 * `getMemory()` devolve a MemoryAPI configurada OU `nullMemory` (degradação: memória fora →
 * chat segue limpo). O dono liga o L3 chamando `configureMemory({ drawers, embed })` UMA vez no
 * boot, com:
 *   - `drawers`: `mongoDrawerCollection(db.collection("memory_drawers"))` (driver `mongodb`);
 *   - `embed`:   uma função gemini-embedding-001 (output_dimensionality = EMBED_DIM).
 * Sem isso, tudo cai em nullMemory (a tool `memory_search` responde `memory_unavailable`).
 *
 * ⚠️ INFRA (dono): `prisma db push` (cria memory_drawers) + índice Atlas Vector `memory_drawers_vec`
 * (dims=EMBED_DIM, cosine, filter userId) [+ índice de texto p/ o ramo RRF]. `mongoDrawerCollection`
 * e o `embed` NÃO foram testados contra um cluster vivo aqui — exigem smoke-test no VPS/CI.
 */
import {
  createMongoMemory,
  nullMemory,
  wingFromSurface,
  isMemorable,
  type Wing,
  type MemoryAPI,
  type MemoryDeps,
  type MemoryScope,
  type Drawer,
  type DrawerCollection,
  type RecallHit,
} from "@/lib/agent/memory";
import type { StructuredAnswer } from "@/lib/agent/contracts";

// No globalThis, não numa variável do módulo: o boot (instrumentation.ts) e as rotas do Next podem carregar
// CÓPIAS diferentes deste módulo no mesmo processo — a configuração feita no boot tem que valer em todas.
const g = globalThis as unknown as { __zaeonMemoriaL3?: MemoryAPI | null };

/** Liga o L3 (no boot — lib/agent/memory-boot.ts, MEMORY_L3=1). A última configuração vence. */
export function configureMemory(deps: MemoryDeps): void {
  try { g.__zaeonMemoriaL3 = createMongoMemory(deps); } catch { g.__zaeonMemoriaL3 = null; }
}

/** Só p/ testes: injeta uma MemoryAPI direta (ou null p/ resetar). */
export function __setMemoryForTest(api: MemoryAPI | null): void { g.__zaeonMemoriaL3 = api; }

/** true se o L3 está realmente ligado (senão os consumidores degradam). */
export function isMemoryConfigured(): boolean { return g.__zaeonMemoriaL3 != null; }

/** A memória ativa — configurada ou nullMemory (nunca lança, nunca é null). */
export function getMemory(): MemoryAPI { return g.__zaeonMemoriaL3 ?? nullMemory; }

// ───────────────────────────── derivação L1 → drawers (verbatim) ─────────────────────────────
export type TurnMemoryInput = {
  userId: string;
  surface: string;          // "estudos" | "pesquisa" | ...
  scopeId?: string | null;  // studyId/researchId → sourceRef
  prompt: string;           // mensagem do usuário
  answer: StructuredAnswer; // resposta final (núcleo + evidência + artefatos)
  course?: string;
  /** Override do andar (Mentores: { kind:"agente", label:"<slug>/<userId>" }). Default: derivado da surface. */
  wing?: Wing;
};

/** Cada mensagem/citação/artefato de PESO vira um Drawer VERBATIM (nunca resumido). */
export function deriveTurnDrawers(input: TurnMemoryInput): Drawer[] {
  const wing = input.wing ?? wingFromSurface(input.surface, { course: input.course });
  const room = input.scopeId || "geral";
  const sourceRef = input.scopeId || undefined;
  const out: Drawer[] = [];
  const push = (kind: Drawer["kind"], text: string, extra?: Partial<Drawer>) => {
    if (text && isMemorable(text, kind)) out.push({ userId: input.userId, wing, room, kind, text, sourceRef, ...extra });
  };
  push("mensagem", (input.prompt || "").trim());
  push("mensagem", (input.answer?.nucleo || "").trim());
  for (const e of input.answer?.evidencia ?? []) {
    if (e?.claim) push("citacao", `${e.claim}${e.source ? ` — ${e.source.title}` : ""}`, { meta: { source: e.source } });
  }
  for (const a of input.answer?.artifacts ?? []) {
    if (a?.title) push("artefato", a.title, { meta: { studioKind: a.studioKind, provenance: a.provenance } });
  }
  return out;
}

/** Escreve a memória do turno (best-effort — NUNCA bloqueia nem derruba a resposta). */
export async function writeTurnMemory(input: TurnMemoryInput): Promise<void> {
  if (!input.userId) return;
  try { await getMemory().write(deriveTurnDrawers(input)); } catch { /* descarta: memória é opcional */ }
}

// ───────────────────────────── wakeUp → bloco de contexto (A8) ─────────────────────────────
/**
 * Recall no início do turno → um bloco de systemContext pronto pra injetar. Inclui o "perfil"
 * pinado (se houver) + os drawers relevantes. Best-effort: erro/vazio → "". SEM LLM no hot path.
 */
export async function wakeUpContext(args: { userId: string; surface: string; hint?: string; wingLabel?: string | null }): Promise<string> {
  if (!args.userId || !isMemoryConfigured()) return "";
  const scope: MemoryScope = { userId: args.userId };
  // wingLabel explícito (Mentores: "<slug>/<userId>") estreita o recall ao andar do mentor; ausente = o da superfície.
  // #562: null = TUDO do dono, sem filtro de andar (o Escritório, na conversa só da pessoa, lembra do chat também).
  const ala = args.wingLabel === null ? undefined : (args.wingLabel ?? args.surface);
  try {
    const [profile, recalled] = await Promise.all([
      getMemory().search("", { userId: args.userId, room: "perfil" }, 1).catch(() => [] as RecallHit[]),
      getMemory().wakeUp(ala ? { ...scope, wingLabel: ala } : scope, args.hint, 6).catch(() => [] as RecallHit[]),
    ]);
    const lines: string[] = [];
    if (profile[0]?.text) lines.push(`Perfil do usuário: ${profile[0].text}`);
    const mems = recalled.filter((r) => r.room !== "perfil").slice(0, 6).map((r) => `- ${r.text}`);
    if (mems.length) lines.push("Memórias relevantes (não invente além disto):\n" + mems.join("\n"));
    return lines.length ? lines.join("\n\n") : "";
  } catch {
    return "";
  }
}

// ───────────────────────────── adaptador Mongo (driver `mongodb`) ─────────────────────────────
/**
 * DrawerCollection sobre uma coleção do driver `mongodb`. Mapeia _id(ObjectId)↔id(string) e
 * string→ObjectId nos filtros de _id. ⚠️ NÃO verificado contra Atlas vivo — o dono roda o
 * smoke-test ($vectorSearch depende do índice `memory_drawers_vec`).
 */
export function mongoDrawerCollection(collection: any, ObjectIdCtor?: any): DrawerCollection {
  const toId = (v: any) => {
    if (!ObjectIdCtor) return v;
    try { return typeof v === "string" ? new ObjectIdCtor(v) : v; } catch { return v; }
  };
  const mapIdFilter = (filter: Record<string, unknown>): Record<string, unknown> => {
    const f = { ...filter };
    if (f._id && typeof f._id === "object" && (f._id as any).$in) {
      f._id = { $in: (f._id as any).$in.map(toId) };
    } else if (f._id != null) {
      f._id = toId(f._id);
    }
    return f;
  };
  return {
    async insertMany(docs) {
      if (!docs.length) return;
      await collection.insertMany(docs);
    },
    async aggregate(pipeline) {
      const raw: any[] = await collection.aggregate(pipeline as any[]).toArray();
      return raw.map((d) => ({ ...d, id: d._id != null ? String(d._id) : d.id })) as RecallHit[];
    },
    async updateMany(filter, update) {
      await collection.updateMany(mapIdFilter(filter), update);
    },
  };
}
