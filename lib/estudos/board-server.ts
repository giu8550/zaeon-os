/**
 * MEUS ESTUDOS — o board no banco (SERVIDOR). Reusa o modelo `Cartolina` (surface `meus-estudos`): dono, membros
 * (`CartolinaMembro`: editor/leitor), convite por link e o `rev` do controle otimista. Os cards são os do
 * lib/estudos/board (validados a cada escrita). Quem muda avisa os outros no canal do board (Pusher): eles relêem na
 * hora em vez de esperar a próxima consulta.
 */
import { prisma } from "@/src/lib/prisma";
import { papelDe, podeEscrever, type Papel } from "@/lib/cartolina/access";
import { triggerSafe } from "@/lib/collab/realtime";
import { SURFACE_ESTUDOS, aplicarOps, boardInicial, lerCards, type CardEstudo, type OpsBoard } from "@/lib/estudos/board";

export type BoardEstudosView = { id: string; titulo: string; cards: CardEstudo[]; rev: number; papel: Papel; donoId: string; updatedAt: Date };
const OID = /^[a-f0-9]{24}$/i;
/** o canal de presença do board (quem está aqui + os avisos de "mudou") */
export const canalBoard = (id: string) => `presence-estudos-${id}`;
export const boardDoCanal = (canal: string): string | null => { const m = /^presence-estudos-([a-f0-9]{24})$/i.exec(canal ?? ""); return m ? m[1]! : null; };
export const EV_MUDOU = "board-mudou";

const view = (row: { id: string; titulo: string; cards: unknown; rev: number; ownerId: string; updatedAt: Date }, papel: Papel): BoardEstudosView =>
  ({ id: row.id, titulo: row.titulo, cards: lerCards(row.cards), rev: row.rev, papel, donoId: row.ownerId, updatedAt: row.updatedAt });

/** o board SÓ se o usuário tem papel nele (e é um board de Meus Estudos) */
export async function boardDoUsuario(id: string, userId: string): Promise<BoardEstudosView | null> {
  if (!OID.test(id)) return null;
  const row = await prisma.cartolina.findUnique({ where: { id } });
  if (!row || row.surface !== SURFACE_ESTUDOS) return null;
  let papelMembro: string | null = null;
  if (row.ownerId !== userId) {
    const m = await prisma.cartolinaMembro.findUnique({ where: { cartolinaId_userId: { cartolinaId: id, userId } }, select: { papel: true } });
    papelMembro = m?.papel ?? null;
  }
  const papel = papelDe(row.ownerId, userId, papelMembro);
  return papel ? view(row, papel) : null;
}

/** o MEU board de estudos (cria na 1ª vez, com o estudo de exemplo) */
export async function meuBoard(userId: string): Promise<BoardEstudosView> {
  const row = await prisma.cartolina.findFirst({ where: { ownerId: userId, surface: SURFACE_ESTUDOS }, orderBy: { updatedAt: "desc" } });
  if (row) return view(row, "dono");
  const novo = await prisma.cartolina.create({ data: { ownerId: userId, surface: SURFACE_ESTUDOS, scopeId: null, titulo: "Meus estudos", cards: boardInicial(userId) as never } });
  return view(novo, "dono");
}

/** os boards de estudos em que sou MEMBRO (convidado) — pra trocar de board */
export async function boardsCompartilhados(userId: string): Promise<{ id: string; titulo: string; donoNome: string }[]> {
  const ms = await prisma.cartolinaMembro.findMany({ where: { userId }, select: { cartolinaId: true }, take: 50 });
  if (!ms.length) return [];
  const rows = await prisma.cartolina.findMany({ where: { id: { in: ms.map((m) => m.cartolinaId) }, surface: SURFACE_ESTUDOS }, select: { id: true, titulo: true, ownerId: true } });
  const donos = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.ownerId) } }, select: { id: true, name: true } });
  const nome = new Map(donos.map((d) => [d.id, d.name ?? "Alguém"] as const));
  return rows.map((r) => ({ id: r.id, titulo: r.titulo, donoNome: nome.get(r.ownerId) ?? "Alguém" }));
}

export type ResultadoPatch = { ok: true; board: BoardEstudosView } | { ok: false; motivo: "not_found" | "forbidden" | "conflict" };
/** aplica as operações com controle otimista (relê e reaplica se outro colaborador gravou no meio) e avisa o canal */
export async function patchBoardEstudos(id: string, userId: string, ops: OpsBoard & { titulo?: unknown }, o: { servidor?: boolean } = {}): Promise<ResultadoPatch> {
  for (let i = 0; i < 5; i++) {
    const atual = await boardDoUsuario(id, userId);
    if (!atual) return { ok: false, motivo: "not_found" };
    if (!podeEscrever(atual.papel)) return { ok: false, motivo: "forbidden" };
    const cards = aplicarOps(atual.cards, ops, o);
    const titulo = typeof ops.titulo === "string" && ops.titulo.trim() ? ops.titulo.trim().slice(0, 200) : atual.titulo;
    const r = await prisma.cartolina.updateMany({ where: { id, rev: atual.rev }, data: { cards: cards as never, titulo, rev: atual.rev + 1 } });
    if (r.count === 1) {
      void triggerSafe(canalBoard(id), EV_MUDOU, { rev: atual.rev + 1, por: userId });
      return { ok: true, board: { ...atual, cards, titulo, rev: atual.rev + 1 } };
    }
  }
  return { ok: false, motivo: "conflict" };
}
