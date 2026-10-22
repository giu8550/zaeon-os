/**
 * BLUEPRINT PRÁTICO — o servidor: a LOJA (um `Cartolina` por estudo, surface `blueprint`, scopeId = thread id da
 * conversa, `cards` = o DocBlueprint) e o TURNO (lib/agent/runChatTurn chama depois do gatekeeper, fire-and-forget).
 *
 * O ciclo (spec §3): a conversa vira estudo VÁLIDO (o gatekeeper do Cérebro — lib/map/gatekeeper) → nasce UM blueprint
 * ligado a ela (idempotente) → a cada turno seguinte a Zaeon RECOMPÕE o mesmo blueprint (no máximo 1× a cada 2 min),
 * preservando a entrega provada (lib/blueprint/compor). Escrita com o `rev` otimista, como o board de Meus Estudos.
 */
import { papelDe, podeEscrever, type Papel } from "@/lib/cartolina/access";
import { COMPOR_SYSTEM, lerPlano, mesclarComposicao, promptComposicao } from "./compor";
import { buscarRepos } from "./github";
import { SURFACE_BLUEPRINT, blueprintOn, docVazio, sanitizarDoc, type Area, type DocBlueprint, type Fase } from "./tipos";

export const INTERVALO_RECOMPOR_MS = 120_000;
const SURFACE_CONVERSA = "estudos";
const OID = /^[a-f0-9]{24}$/i;

type Linha = { id: string; ownerId: string; surface: string; scopeId: string | null; titulo: string; cards: unknown; rev: number; createdAt: Date; updatedAt: Date };
type Onde = { id?: string; ownerId?: string; surface?: string; scopeId?: string };
/** o pedaço do Prisma que a loja usa (injetável nos testes) */
export type BlueprintDb = {
  cartolina: {
    findFirst(a: { where: Onde; orderBy?: { createdAt?: "asc" | "desc"; updatedAt?: "asc" | "desc" } }): Promise<Linha | null>;
    findUnique(a: { where: { id: string } }): Promise<Linha | null>;
    findMany(a: { where: Onde; orderBy?: { updatedAt?: "asc" | "desc"; createdAt?: "asc" | "desc" }; take?: number }): Promise<Linha[]>;
    create(a: { data: { ownerId: string; surface: string; scopeId: string; titulo: string; cards: never } }): Promise<Linha>;
    updateMany(a: { where: { id: string; rev: number }; data: { cards: never; titulo: string; rev: number } }): Promise<{ count: number }>;
    deleteMany(a: { where: { id: string } }): Promise<{ count: number }>;
  };
  cartolinaMembro: { findUnique(a: { where: { cartolinaId_userId: { cartolinaId: string; userId: string } }; select: { papel: true } }): Promise<{ papel: string } | null> };
  conversation: { findFirst(a: { where: { userId: string; surface: string; scopeId: string }; select: { estudavel: true } }): Promise<{ estudavel: boolean } | null> };
};
const prismaDb = async (): Promise<BlueprintDb> => (await import("@/src/lib/prisma")).prisma as unknown as BlueprintDb;

export type BlueprintView = { id: string; scopeId: string | null; doc: DocBlueprint; rev: number; papel: Papel; updatedAt: Date };
export type ResumoBlueprint = { id: string; titulo: string; area: Area; fase: Fase; aguardandoMentor: boolean; criticosAbertos: number; fasesAprovadas: number; updatedAt: string };

/** o documento de uma linha (o corrompido volta como um blueprint vazio com o título da linha — nunca lança) */
export const docDaLinha = (l: Pick<Linha, "cards" | "titulo" | "createdAt">): DocBlueprint => sanitizarDoc(l.cards) ?? docVazio(l.titulo, l.createdAt.getTime());
/** as fases aprovadas: as anteriores à atual (só avança aprovando) + a final, quando aguarda o mentor */
export const fasesAprovadas = (d: Pick<DocBlueprint, "fase" | "aguardandoMentor">): number => d.fase - 1 + (d.aguardandoMentor ? 1 : 0);

export function resumoDe(l: Linha): ResumoBlueprint {
  const d = docDaLinha(l);
  return { id: l.id, titulo: d.titulo, area: d.area, fase: d.fase, aguardandoMentor: d.aguardandoMentor, criticosAbertos: d.criticos.filter((c) => c.status === "aberto" && c.fase === d.fase).length, fasesAprovadas: fasesAprovadas(d), updatedAt: l.updatedAt.toISOString() };
}

export async function listarBlueprints(userId: string, db?: BlueprintDb): Promise<ResumoBlueprint[]> {
  const d = db ?? (await prismaDb());
  const rows = await d.cartolina.findMany({ where: { ownerId: userId, surface: SURFACE_BLUEPRINT }, orderBy: { updatedAt: "desc" }, take: 40 });
  return rows.map(resumoDe);
}

/** o blueprint SÓ se o usuário tem papel nele */
export async function blueprintDoUsuario(id: string, userId: string, db?: BlueprintDb): Promise<BlueprintView | null> {
  if (!OID.test(id)) return null;
  const d = db ?? (await prismaDb());
  const row = await d.cartolina.findUnique({ where: { id } });
  if (!row || row.surface !== SURFACE_BLUEPRINT) return null;
  const membro = row.ownerId === userId ? null : await d.cartolinaMembro.findUnique({ where: { cartolinaId_userId: { cartolinaId: id, userId } }, select: { papel: true } });
  const papel = papelDe(row.ownerId, userId, membro?.papel ?? null);
  return papel ? { id: row.id, scopeId: row.scopeId, doc: docDaLinha(row), rev: row.rev, papel, updatedAt: row.updatedAt } : null;
}

export type ResultadoGravar = { ok: true; view: BlueprintView } | { ok: false; motivo: "not_found" | "forbidden" | "conflict" };
/** muda o documento com controle otimista (relê e reaplica se alguém gravou no meio); o resultado passa pelo saneamento */
export async function gravarDoc(id: string, userId: string, mudar: (d: DocBlueprint) => DocBlueprint, db?: BlueprintDb): Promise<ResultadoGravar> {
  const d = db ?? (await prismaDb());
  for (let i = 0; i < 5; i++) {
    const atual = await blueprintDoUsuario(id, userId, d);
    if (!atual) return { ok: false, motivo: "not_found" };
    if (!podeEscrever(atual.papel)) return { ok: false, motivo: "forbidden" };
    const doc = sanitizarDoc(mudar(atual.doc)) ?? atual.doc;
    const r = await d.cartolina.updateMany({ where: { id, rev: atual.rev }, data: { cards: doc as never, titulo: doc.titulo, rev: atual.rev + 1 } });
    if (r.count === 1) return { ok: true, view: { ...atual, doc, rev: atual.rev + 1, updatedAt: new Date() } };
  }
  return { ok: false, motivo: "conflict" };
}

/** o blueprint da conversa — cria na 1ª vez. Dois turnos ao mesmo tempo: o mais ANTIGO vence e o outro se apaga */
export async function garantirBlueprint(userId: string, scopeId: string, titulo: string, db?: BlueprintDb): Promise<string> {
  const d = db ?? (await prismaDb());
  const onde = { ownerId: userId, surface: SURFACE_BLUEPRINT, scopeId };
  const ja = await d.cartolina.findFirst({ where: onde, orderBy: { createdAt: "asc" } });
  if (ja) return ja.id;
  const novo = await d.cartolina.create({ data: { ...onde, titulo: titulo.slice(0, 200) || "Estudo", cards: docVazio(titulo, Date.now()) as never } });
  const primeiro = await d.cartolina.findFirst({ where: onde, orderBy: { createdAt: "asc" } });
  if (primeiro && primeiro.id !== novo.id) { await d.cartolina.deleteMany({ where: { id: novo.id } }); return primeiro.id; }
  return novo.id;
}

export type GenJson = <T>(system: string, user: string) => Promise<T>;
export type EntradaTurno = {
  userId: string | null; scopeId: string | null;
  sinal: { estudavel: boolean; tituloSugerido: string } | null;
  prompt: string; answerTexto: string; history: { role: string; text: string }[];
  agora?: number; forcar?: boolean;
  db?: BlueprintDb; gen?: GenJson; repos?: typeof buscarRepos; passosBase?: (tema: string) => Promise<string[]>;
};

const genPadrao = (userId: string, scopeId: string): GenJson => async <T,>(system: string, user: string) => {
  const [{ geminiJson }, { GEMINI_MODEL_FLASH }] = await Promise.all([import("@/lib/scholar/gemini"), import("@/lib/ai/model")]);
  return geminiJson<T>(system, user, { temperature: 0.3, model: GEMINI_MODEL_FLASH, timeoutMs: 60_000, ctx: { agentKey: "zaeon", surface: "estudos", userId, scopeId, phase: "blueprint" } });
};
const passosPadrao = async (tema: string): Promise<string[]> => (await (await import("@/lib/estudos/harness-server")).gerarPassos(tema)).map((p) => p.label);

/** o turno do blueprint: cria (se a conversa é estudo) e recompõe (se passou o intervalo). Nunca lança. */
export async function blueprintDoTurno(i: EntradaTurno): Promise<"off" | "nao-estudo" | "aguardando" | "composto" | "falhou"> {
  if (!blueprintOn()) return "off";
  if (!i.userId || !i.scopeId) return "nao-estudo";
  const { userId, scopeId } = i, agora = i.agora ?? Date.now();
  try {
    const db = i.db ?? (await prismaDb());
    let linha = await db.cartolina.findFirst({ where: { ownerId: userId, surface: SURFACE_BLUEPRINT, scopeId }, orderBy: { createdAt: "asc" } });
    if (!linha) {
      const conv = i.sinal?.estudavel ? null : await db.conversation.findFirst({ where: { userId, surface: SURFACE_CONVERSA, scopeId }, select: { estudavel: true } });
      if (!i.sinal?.estudavel && !conv?.estudavel) return "nao-estudo";
      const id = await garantirBlueprint(userId, scopeId, i.sinal?.tituloSugerido || "Estudo", db);
      linha = await db.cartolina.findUnique({ where: { id } });
      if (!linha) return "falhou";
    }
    const doc = docDaLinha(linha);
    if (!i.forcar && agora - doc.compostoEm < INTERVALO_RECOMPOR_MS) return "aguardando";
    const conversa = [...i.history.slice(-10), { role: "user", text: i.prompt }, { role: "assistant", text: i.answerTexto }].filter((m) => m.text?.trim());
    const passosBase = doc.turnos === 0 ? await (i.passosBase ?? passosPadrao)(doc.titulo).catch(() => []) : undefined;
    const gen = i.gen ?? genPadrao(userId, scopeId);
    const plano = lerPlano(await gen<unknown>(COMPOR_SYSTEM, promptComposicao({ doc, conversa, passosBase })));
    if (!plano) return "falhou";
    const achados = await (i.repos ?? buscarRepos)(plano.termosRepo).catch(() => []);
    const r = await gravarDoc(linha.id, userId, (atual) => {
      const novo = mesclarComposicao(atual, plano, agora);
      if (achados.length) { const meus = atual.repos.filter((x) => x.meu); novo.repos = [...meus, ...achados.filter((x) => !meus.some((m) => m.nome === x.nome))]; }
      return novo;
    }, db);
    return r.ok ? "composto" : "falhou";
  } catch (e: unknown) {
    console.warn("[blueprint] turno falhou:", e instanceof Error ? e.message : e);
    return "falhou";
  }
}
