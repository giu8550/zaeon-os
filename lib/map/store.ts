/**
 * lib/map/store.ts — acesso ao banco do cérebro (MapaProbabilistico). Mesma disciplina da
 * cartolina: toda leitura POR ID exige o userId (dono ou membro da cartolina do mesmo scope —
 * estudo compartilhado) e "sem acesso" é indistinguível de "não existe" (null → 404).
 * Escrita com controle otimista por `rev` (relê, reaplica, grava só se o rev bater).
 */
import { prisma } from "@/src/lib/prisma";
import { readArestas, readNos, MAX_NOS } from "@/lib/map/grafo";
import { isModoValidacao, isTipoTopico, type MapaAresta, type MapaNo, type MapaView } from "@/lib/map/tipos";

export const MAP_SURFACES = ["estudos", "pesquisa"] as const;
export type MapSurface = (typeof MAP_SURFACES)[number];
export const isMapSurface = (v: unknown): v is MapSurface => typeof v === "string" && (MAP_SURFACES as readonly string[]).includes(v);

const isObjectId = (v: string) => /^[a-f0-9]{24}$/i.test(v);

export function viewDeLinha(row: any): MapaView {
  const nos = readNos(row.nos);
  return {
    id: row.id, ownerId: row.ownerId, surface: row.surface, scopeId: row.scopeId, titulo: row.titulo,
    tipoTopico: isTipoTopico(row.tipoTopico) ? row.tipoTopico : "exploratorio",
    objetivo: row.objetivo ?? "",
    modoValidacao: isModoValidacao(row.modoValidacao) ? row.modoValidacao : "nenhuma",
    criterioCompletude: row.criterioCompletude ?? "",
    nos, arestas: readArestas(row.arestas, nos),
    backbone: Array.isArray(row.backbone) ? row.backbone.filter((x: unknown): x is string => typeof x === "string") : [],
    completudeAprendizado: Number(row.completudeAprendizado) || 0,
    completudeConclusao: Number(row.completudeConclusao) || 0,
    rev: row.rev ?? 0, updatedAt: row.updatedAt,
  };
}

/** O mapa do DONO para o estudo (surface + scopeId). */
export async function findOwnMapa(ownerId: string, surface: MapSurface, scopeId: string): Promise<MapaView | null> {
  const row = await prisma.mapaProbabilistico.findUnique({ where: { ownerId_surface_scopeId: { ownerId, surface, scopeId } } });
  return row ? viewDeLinha(row) : null;
}

/**
 * O mapa por id, SÓ se o usuário é o dono ou membro da cartolina do mesmo estudo (coworking).
 * Devolve também o papel pra quem precisa decidir escrita.
 */
export async function getMapaForUser(id: string, userId: string): Promise<{ mapa: MapaView; papel: "dono" | "editor" | "leitor" } | null> {
  if (!isObjectId(id) || !isObjectId(userId)) return null;
  const row = await prisma.mapaProbabilistico.findUnique({ where: { id } });
  if (!row) return null;
  if (row.ownerId === userId) return { mapa: viewDeLinha(row), papel: "dono" };
  // Estudo compartilhado: a permissão vem da cartolina do mesmo (ownerId, scopeId) — uma só regra.
  const board = await prisma.cartolina.findFirst({ where: { ownerId: row.ownerId, surface: "estudos", scopeId: row.scopeId }, select: { id: true } });
  if (!board) return null;
  const m = await prisma.cartolinaMembro.findUnique({ where: { cartolinaId_userId: { cartolinaId: board.id, userId } }, select: { papel: true } });
  if (!m || (m.papel !== "editor" && m.papel !== "leitor")) return null;
  return { mapa: viewDeLinha(row), papel: m.papel };
}

export async function createMapa(input: {
  ownerId: string; surface: MapSurface; scopeId: string; titulo: string;
  nos: MapaNo[]; arestas: MapaAresta[];
  tipoTopico?: string; objetivo?: string; modoValidacao?: string; criterioCompletude?: string; backbone?: string[];
}): Promise<MapaView> {
  const row = await prisma.mapaProbabilistico.create({
    data: {
      ownerId: input.ownerId, surface: input.surface, scopeId: input.scopeId,
      titulo: input.titulo.slice(0, 200) || "Estudo",
      nos: input.nos.slice(0, MAX_NOS) as any, arestas: input.arestas as any,
      ...(input.tipoTopico ? { tipoTopico: input.tipoTopico } : {}),
      ...(input.objetivo ? { objetivo: input.objetivo.slice(0, 500) } : {}),
      ...(input.modoValidacao ? { modoValidacao: input.modoValidacao } : {}),
      ...(input.criterioCompletude ? { criterioCompletude: input.criterioCompletude.slice(0, 500) } : {}),
      ...(input.backbone ? { backbone: input.backbone } : {}),
    },
  });
  return viewDeLinha(row);
}

export type PatchMapaResult = { ok: true; mapa: MapaView } | { ok: false; reason: "not_found" | "conflict" };
const MAX_TENTATIVAS = 5;

/**
 * Aplica uma transformação PURA sobre o estado atual, com controle otimista. `fn` recebe a view
 * relida e devolve os campos a gravar (ou null = nada a fazer). Perdeu a corrida → relê e reaplica.
 * Quem chama já decidiu a permissão (dono via findOwnMapa, ou getMapaForUser + papel).
 */
export async function patchMapa(
  id: string,
  fn: (atual: MapaView) => Partial<Pick<MapaView, "nos" | "arestas" | "backbone" | "titulo" | "tipoTopico" | "objetivo" | "modoValidacao" | "criterioCompletude" | "completudeAprendizado" | "completudeConclusao">> | null,
): Promise<PatchMapaResult> {
  if (!isObjectId(id)) return { ok: false, reason: "not_found" };
  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    const row = await prisma.mapaProbabilistico.findUnique({ where: { id } });
    if (!row) return { ok: false, reason: "not_found" };
    const atual = viewDeLinha(row);
    const delta = fn(atual);
    if (!delta) return { ok: true, mapa: atual };
    const data: any = { rev: atual.rev + 1 };
    if (delta.nos) data.nos = delta.nos.slice(0, MAX_NOS);
    if (delta.arestas) data.arestas = delta.arestas;
    if (delta.backbone) data.backbone = delta.backbone;
    if (typeof delta.titulo === "string") data.titulo = delta.titulo.slice(0, 200);
    if (delta.tipoTopico) data.tipoTopico = delta.tipoTopico;
    if (typeof delta.objetivo === "string") data.objetivo = delta.objetivo.slice(0, 500);
    if (delta.modoValidacao) data.modoValidacao = delta.modoValidacao;
    if (typeof delta.criterioCompletude === "string") data.criterioCompletude = delta.criterioCompletude.slice(0, 500);
    if (typeof delta.completudeAprendizado === "number") data.completudeAprendizado = delta.completudeAprendizado;
    if (typeof delta.completudeConclusao === "number") data.completudeConclusao = delta.completudeConclusao;
    const r = await prisma.mapaProbabilistico.updateMany({ where: { id, rev: atual.rev }, data });
    if (r.count === 1) return { ok: true, mapa: { ...atual, ...delta, rev: atual.rev + 1 } as MapaView };
  }
  return { ok: false, reason: "conflict" };
}
