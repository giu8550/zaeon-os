/**
 * lib/queue/octa.ts — fila `octa-turno`: um turno do agente Octa no fluxo landing roda em JOB, não na requisição.
 * Molde de lib/queue/chores.ts:
 *
 *   OCTA_QUEUE=1 (+ REDIS_URL) → BullMQ; o worker (OCTA_WORKER=1, instrumentation) consome.
 *   Sem fila → INLINE no próprio processo web (dispara e devolve o turnoId na hora).
 *
 * Regras:
 * - Todo turno daqui é `fluxo: "landing"`, `modo: "change"`, `liberados: ["**"]` (o projeto é inteiro do aluno) e
 *   a `permissao` vem do PROJETO (OctaProjeto.permissao), nunca do pedido.
 * - O estado para retomar (msgs + a tool pendente) mora SÓ no OctaTurno. Aprovar = o cliente manda `{ aprovado }`;
 *   só um turno `aguardando_aprovacao` aceita (troca atômica de status → aprovar 2× dá `nao_aguardando`).
 * - Eventos (OctaEvento, seq crescente por turno) nunca levam segredo: vêm do onEvento do laço (nome de tool,
 *   caminho, código, resumo já redigido) ou são códigos fixos daqui. Mensagem crua de erro (gateway, octokit) não entra.
 * - Um turno ativo por projeto. `rodando` sem sinal de vida há PRESO_MS vira `erro` (tempo_esgotado) e não trava.
 */
import { rodarAgenteOcta, ferramentasGateway, type ChamarModelo, type MsgModelo, type PendenteOcta, type TipoEventoOcta, type Workspace } from "@/lib/octa/agente";
import { lerProjeto, salvarArquivos, type Arquivos, type ProjetosDb } from "@/lib/octa/projetos";
import { publicarProjeto, type ResultadoPublicar } from "@/lib/octa/publicar";

export const OCTA_QUEUE = "octa-turno";
type Env = Record<string, string | undefined>;

export const filaLigada = (env: Env = process.env): boolean => env.OCTA_QUEUE === "1" && Boolean(env.REDIS_URL);

/** `rodando` sem evento novo há mais que isto = processo morreu no meio (cada passo do modelo tem teto bem menor). */
export const PRESO_MS = 10 * 60_000;
const ATIVOS = ["rodando", "aguardando_aprovacao"];
const HISTORICO_TURNOS = 6;
const ID_OBJECT = /^[0-9a-f]{24}$/i;

export type StatusTurno = "rodando" | "aguardando_aprovacao" | "pronto" | "erro";
/** Códigos fixos dos eventos de erro — é só isso que o cliente vê de uma falha. */
export type CodigoErroTurno = "falha_modelo" | "budget" | "projeto_inexistente" | "tempo_esgotado";

export type TurnoRow = {
  id: string; userId: string; email: string; projetoId: string; pedido: string; status: StatusTurno;
  estado: { msgs: MsgModelo[]; aprovado?: boolean } | null; pendente: PendenteOcta | null; resposta: string | null;
  createdAt: Date; updatedAt: Date;
};
export type EventoRow = { id?: string; turnoId: string; seq: number; tipo: TipoEventoOcta; dados: Record<string, unknown>; em: Date };

/** O recorte do Prisma que o turno usa (injetável no teste). */
export type TurnosDb = ProjetosDb & {
  octaTurno: {
    create(a: { data: any }): Promise<any>;
    findUnique(a: { where: { id: string } }): Promise<any | null>;
    findFirst(a: { where: any; orderBy?: any }): Promise<any | null>;
    findMany(a: { where: any; orderBy?: any; take?: number }): Promise<any[]>;
    update(a: { where: { id: string }; data: any }): Promise<any>;
    updateMany(a: { where: any; data: any }): Promise<{ count: number }>;
  };
  octaEvento: {
    create(a: { data: any }): Promise<any>;
    findFirst(a: { where: any; orderBy?: any }): Promise<any | null>;
    findMany(a: { where: any; orderBy?: any; take?: number }): Promise<any[]>;
  };
};

export type FilaTurno = { add(turnoId: string): Promise<void> };

export type DepsTurno = {
  db: TurnosDb;
  /** O modelo de UM turno (gateway + virtual key do aluno). */
  chamador: (p: { userId: string; turnoId: string }) => Promise<ChamarModelo>;
  /** Octokit do GitHub do aluno (lib/projects/github-user.getUserOctokit). */
  octokitDoAluno: (email: string) => Promise<any | null>;
  agora?: () => Date;
  /** null = inline; ausente = BullMQ se OCTA_QUEUE=1 + REDIS_URL, senão inline. */
  fila?: FilaTurno | null;
};

export type CodigoErroOcta = "projeto_inexistente" | "turno_ativo" | "turno_inexistente" | "nao_aguardando";
export class ErroTurno extends Error {
  constructor(public codigo: CodigoErroOcta, public turnoId?: string) { super(codigo); this.name = "ErroTurno"; }
}

// ───────────────────────────── fila ─────────────────────────────
async function loadBullmq(): Promise<any | null> {
  try { const spec = "bull" + "mq"; return await import(/* webpackIgnore: true */ spec as any); } catch { return null; }
}

let _queue: any = null;
async function filaBull(): Promise<FilaTurno | null> {
  if (!filaLigada()) return null;
  if (!_queue) {
    const bull = await loadBullmq();
    if (!bull) return null;
    const { getRedisConnection } = await import("@/lib/queue/scholar");
    // attempts:1 — repetir um turno republicaria/regravaria; quem falhou vira `erro` e o aluno pede de novo.
    _queue = new bull.Queue(OCTA_QUEUE, { connection: getRedisConnection() as any, defaultJobOptions: { attempts: 1, removeOnComplete: 200, removeOnFail: 200 } });
  }
  return { add: async (turnoId) => { await _queue.add("turno", { turnoId }, { jobId: `octa_${turnoId}_${Date.now()}` }); } };
}

/** Manda o turno pra fila; sem fila (ou fila fora do ar), roda inline sem segurar quem chamou. */
async function disparar(deps: DepsTurno, turnoId: string): Promise<"fila" | "inline"> {
  try {
    const fila = deps.fila === undefined ? await filaBull() : deps.fila;
    if (fila) { await fila.add(turnoId); return "fila"; }
  } catch {
    console.warn("[octa-turno] fila indisponível — rodando inline");
  }
  void processarTurno(deps, turnoId).catch(() => console.warn("[octa-turno] inline falhou"));
  return "inline";
}

// ───────────────────────────── eventos ─────────────────────────────
async function proximoSeq(db: TurnosDb, turnoId: string): Promise<number> {
  const ult = await db.octaEvento.findFirst({ where: { turnoId }, orderBy: { seq: "desc" } });
  return (ult?.seq ?? 0) + 1;
}

async function erroNoTurno(db: TurnosDb, turnoId: string, codigo: CodigoErroTurno, agora: Date, de: StatusTurno = "rodando"): Promise<boolean> {
  const r = await db.octaTurno.updateMany({ where: { id: turnoId, status: de }, data: { status: "erro", estado: null, pendente: null } });
  if (!r.count) return false;
  await db.octaEvento.create({ data: { turnoId, seq: await proximoSeq(db, turnoId), tipo: "erro", dados: { codigo }, em: agora } });
  return true;
}

/** Marca como erro os `rodando` sem sinal de vida há PRESO_MS (boot do worker e antes de abrir turno novo). */
export async function reapTurnosPresos(db: TurnosDb, agora = new Date(), onde: Record<string, unknown> = {}): Promise<number> {
  const presos = await db.octaTurno.findMany({ where: { ...onde, status: "rodando", updatedAt: { lt: new Date(agora.getTime() - PRESO_MS) } } });
  let n = 0;
  for (const t of presos) if (await erroNoTurno(db, t.id, "tempo_esgotado", agora)) n++;
  if (n) console.log(`[octa-turno] reaper: ${n} preso(s) → erro`);
  return n;
}

export async function listarEventos(
  db: TurnosDb, p: { userId: string; turnoId: string; depois: number },
): Promise<{ status: StatusTurno; eventos: EventoRow[]; pendente: { tool: string; path?: string } | null; resposta: string | null } | null> {
  if (!ID_OBJECT.test(String(p.turnoId))) return null;
  const t: TurnoRow | null = await db.octaTurno.findFirst({ where: { id: p.turnoId, userId: p.userId } });
  if (!t) return null;
  const eventos: EventoRow[] = await db.octaEvento.findMany({ where: { turnoId: t.id, seq: { gt: p.depois } }, orderBy: { seq: "asc" }, take: 500 });
  // da tool pendente o cliente só vê nome e caminho (args podem trazer o arquivo inteiro)
  const path = (t.pendente?.args as any)?.path;
  const pendente = t.status === "aguardando_aprovacao" && t.pendente ? { tool: t.pendente.tool, ...(typeof path === "string" ? { path } : {}) } : null;
  return { status: t.status, eventos: eventos.map(({ seq, tipo, dados, em }) => ({ turnoId: t.id, seq, tipo, dados, em })), pendente, resposta: t.resposta };
}

// ───────────────────────────── iniciar / aprovar ─────────────────────────────
export async function iniciarTurno(deps: DepsTurno, p: { userId: string; email: string; projetoId: string; pedido: string }): Promise<{ turnoId: string }> {
  const agora = deps.agora?.() ?? new Date();
  const projeto = await lerProjeto(deps.db, p.userId, p.projetoId);
  if (!projeto) throw new ErroTurno("projeto_inexistente");
  await reapTurnosPresos(deps.db, agora, { projetoId: projeto.id });
  const ativo = await deps.db.octaTurno.findFirst({ where: { projetoId: projeto.id, status: { in: ATIVOS } } });
  if (ativo) throw new ErroTurno("turno_ativo", ativo.id);
  const t = await deps.db.octaTurno.create({
    data: { userId: p.userId, email: p.email, projetoId: projeto.id, pedido: p.pedido, status: "rodando", estado: null, pendente: null, resposta: null },
  });
  await disparar(deps, t.id);
  return { turnoId: t.id };
}

/** Retoma o turno parado em aprovação com a decisão do aluno. Só o dono, só se ainda estiver aguardando. */
export async function aprovarTurno(deps: DepsTurno, p: { userId: string; turnoId: string; aprovado: boolean }): Promise<void> {
  if (!ID_OBJECT.test(String(p.turnoId))) throw new ErroTurno("turno_inexistente");
  const t: TurnoRow | null = await deps.db.octaTurno.findFirst({ where: { id: p.turnoId, userId: p.userId } });
  if (!t) throw new ErroTurno("turno_inexistente");
  if (t.status !== "aguardando_aprovacao" || !t.pendente || !t.estado?.msgs?.length) throw new ErroTurno("nao_aguardando");
  // o laço retoma a 1ª chamada sem resposta da última mensagem do assistente: tem que ser a pendente guardada
  if (primeiraSemResposta(t.estado.msgs) !== t.pendente.toolCallId) throw new ErroTurno("nao_aguardando");
  // troca atômica: dois "aprovar" ao mesmo tempo → só um passa (o outro vê count 0)
  const r = await deps.db.octaTurno.updateMany({
    where: { id: t.id, userId: p.userId, status: "aguardando_aprovacao" },
    data: { status: "rodando", estado: { msgs: t.estado.msgs, aprovado: p.aprovado } },
  });
  if (!r.count) throw new ErroTurno("nao_aguardando");
  await disparar(deps, t.id);
}

function primeiraSemResposta(msgs: MsgModelo[]): string | undefined {
  const i = msgs.map((m) => m.role).lastIndexOf("assistant");
  const ult = msgs[i];
  if (i < 0 || ult.role !== "assistant" || !ult.tool_calls?.length) return undefined;
  const respondidas = new Set(msgs.slice(i + 1).flatMap((m) => (m.role === "tool" ? [m.tool_call_id] : [])));
  return ult.tool_calls.find((c) => !respondidas.has(c.id))?.id;
}

// ───────────────────────────── processar (worker e inline) ─────────────────────────────
class TurnoInterrompido extends Error {}

const ehDesign = (p: string) => p.split("/").pop()?.toLowerCase() === "design.md";

export async function processarTurno(deps: DepsTurno, turnoId: string): Promise<void> {
  const { db } = deps;
  const agora = () => deps.agora?.() ?? new Date();
  const t: TurnoRow | null = await db.octaTurno.findUnique({ where: { id: turnoId } });
  if (!t || t.status !== "rodando") return; // idempotente: job repetido não roda de novo

  let seq = await proximoSeq(db, t.id);
  const emitir = async (tipo: TipoEventoOcta, dados: Record<string, unknown>) => {
    // sinal de vida + garante que ninguém (reaper) tirou o turno de `rodando` no meio
    const vivo = await db.octaTurno.updateMany({ where: { id: t.id, status: "rodando" }, data: { updatedAt: agora() } });
    if (!vivo.count) throw new TurnoInterrompido();
    await db.octaEvento.create({ data: { turnoId: t.id, seq: seq++, tipo, dados, em: agora() } });
  };

  const projeto = await lerProjeto(db, t.userId, t.projetoId);
  if (!projeto) { await erroNoTurno(db, t.id, "projeto_inexistente", agora()); return; }
  const base: Arquivos = { ...(projeto.arquivos ?? {}) };

  // publicar lê do banco: grava o que o turno tem agora (DESIGN.md do projeto fica — ele só não vai pro GitHub)
  const octaPublicar = async (p: { arquivos: Workspace; mensagem?: string }): Promise<ResultadoPublicar> => {
    try {
      const atual = await lerProjeto(db, t.userId, t.projetoId);
      const designs = Object.fromEntries(Object.entries(atual?.arquivos ?? {}).filter(([k]) => ehDesign(k)));
      await salvarArquivos(db, t.userId, t.projetoId, { ...designs, ...p.arquivos });
      return await publicarProjeto({ db, octokitDoAluno: deps.octokitDoAluno, agora }, { userId: t.userId, email: t.email, projetoId: t.projetoId, mensagem: p.mensagem });
    } catch {
      return { ok: false, erro: "falha_github" }; // nada do erro (pode ecoar token) volta pro modelo
    }
  };

  try {
    const anteriores = t.estado?.msgs ? [] : await historico(db, t);
    const chamar = await deps.chamador({ userId: t.userId, turnoId: t.id });
    const r = await rodarAgenteOcta(
      { historico: anteriores, pedido: t.pedido, workspace: base, modo: "change", liberados: ["**"], fluxo: "landing" },
      chamar,
      {
        sessionId: `octa-turno-${t.id}`, userId: t.userId, permissao: projeto.permissao, octaPublicar,
        retomar: t.estado?.msgs ? { msgs: t.estado.msgs, aprovado: t.estado.aprovado === true } : undefined,
        onEvento: (e) => emitir(e.tipo, e.dados),
      },
    );
    const arquivos: Arquivos = { ...base, ...r.edicoes };
    for (const p of r.apagados) delete arquivos[p];
    if (Object.keys(r.edicoes).length || r.apagados.length) await salvarArquivos(db, t.userId, t.projetoId, arquivos);

    if (r.pendente) {
      const ok = await db.octaTurno.updateMany({
        where: { id: t.id, status: "rodando" },
        data: { status: "aguardando_aprovacao", estado: { msgs: r.msgs }, pendente: r.pendente, resposta: r.resposta },
      });
      if (!ok.count) throw new TurnoInterrompido();
      return; // o evento "aprovacao" já saiu do laço
    }
    await emitir("fim", { resposta: r.resposta.slice(0, 4000) });
    await db.octaTurno.updateMany({ where: { id: t.id, status: "rodando" }, data: { status: "pronto", estado: null, pendente: null, resposta: r.resposta } });
  } catch (e) {
    if (e instanceof TurnoInterrompido) return;
    const codigo: CodigoErroTurno = /orçamento/.test(String((e as Error)?.message)) ? "budget" : "falha_modelo";
    console.warn("[octa-turno] turno falhou", { turnoId: t.id, codigo }); // sem a mensagem: pode ter segredo do gateway
    await erroNoTurno(db, t.id, codigo, agora()).catch(() => undefined);
  }
}

/** Conversa dos últimos turnos prontos do projeto (pedido → resposta): "agora publica" precisa do contexto. */
async function historico(db: TurnosDb, t: TurnoRow): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const prontos: TurnoRow[] = await db.octaTurno.findMany({ where: { projetoId: t.projetoId, userId: t.userId, status: "pronto" }, orderBy: { createdAt: "desc" }, take: HISTORICO_TURNOS });
  return prontos.reverse().flatMap((x) => [
    { role: "user" as const, content: x.pedido.slice(0, 4000) },
    { role: "assistant" as const, content: String(x.resposta ?? "").slice(0, 4000) },
  ]);
}

// ───────────────────────────── deps reais ─────────────────────────────
const BUDGET_USD = 1;
const DURACAO = "2h";
// virtual key por aluno, reaproveitada até perto de vencer (mesma política de /api/octa/agente)
const chaves = new Map<string, { key: string; ate: number }>();

/** Prisma + gateway LiteLLM (virtual key do aluno, Google primeiro no landing) + octokit do aluno. */
export async function depsReais(env: Env = process.env): Promise<DepsTurno> {
  const { prisma } = await import("@/src/lib/prisma");
  const { emitirVirtualKey, classificarRespostaGateway, gatewayCfg } = await import("@/lib/octa/litellm");
  const { criarChamadorOcta, escolhaModeloOcta } = await import("@/lib/octa/modelo");
  const { getUserOctokit } = await import("@/lib/projects/github-user");
  const ferramentas = ferramentasGateway("landing");

  async function chaveDe(userId: string, turnoId: string): Promise<string> {
    const c = chaves.get(userId);
    if (c && c.ate > Date.now() + 60_000) return c.key;
    const r = await emitirVirtualKey({ userId, sessionId: `octa-turno-${turnoId}`, maxBudgetUsd: BUDGET_USD, duracao: DURACAO });
    if (!r.ok) throw new Error(r.error);
    chaves.set(userId, { key: r.vk.key, ate: Date.now() + 2 * 3600_000 });
    return r.vk.key;
  }

  return {
    db: prisma as unknown as TurnosDb,
    octokitDoAluno: (email) => getUserOctokit(email),
    async chamador({ userId, turnoId }) {
      const key = await chaveDe(userId, turnoId);
      return criarChamadorOcta(async (model, msgs, signal) => {
        const r = await fetch(`${gatewayCfg().url}/chat/completions`, {
          method: "POST", signal,
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({ model, messages: msgs, tools: ferramentas, temperature: 0.2 }),
        });
        const cls = await classificarRespostaGateway(r.clone());
        if (!cls.ok) { if (cls.code === "budget_exceeded") chaves.delete(userId); throw new Error(cls.error); }
        const j: any = await r.json();
        const m = j.choices?.[0]?.message ?? {};
        return { content: m.content ?? null, tool_calls: m.tool_calls, usage: j.usage, modeloId: r.headers.get("x-litellm-model-id") };
      }, escolhaModeloOcta(env, "landing"));
    },
  };
}

/** Worker BullMQ (instrumentation, OCTA_WORKER=1). */
export async function iniciarWorkerOcta(env: Env = process.env): Promise<boolean> {
  if (env.OCTA_WORKER !== "1" || !filaLigada(env)) return false;
  const bull = await loadBullmq();
  if (!bull) return false;
  const { Worker } = bull as { Worker: new (n: string, p: (job: any) => Promise<void>, o: Record<string, unknown>) => { on(ev: string, fn: (...a: any[]) => void): void } };
  const { getRedisConnection } = await import("@/lib/queue/scholar");
  const deps = await depsReais(env);
  await reapTurnosPresos(deps.db).catch(() => console.warn("[octa-worker] reaper falhou"));
  const concurrency = Math.max(1, Number(env.OCTA_WORKER_CONCURRENCY || 2) || 2);
  const worker = new Worker(OCTA_QUEUE, async (job) => { await processarTurno(deps, String(job.data?.turnoId ?? "")); }, { connection: getRedisConnection()! as any, concurrency });
  worker.on("failed", (job: any) => console.error("[octa-worker] job falhou:", job?.id));
  console.log(`[octa-worker] ouvindo "${OCTA_QUEUE}" (concurrency=${concurrency})`);
  return true;
}
