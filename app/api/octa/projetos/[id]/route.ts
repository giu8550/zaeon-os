/**
 * GET/PATCH/DELETE /api/octa/projetos/[id] — um projeto do aluno logado.
 * PATCH aceita arquivos (≤200 / 1,5 MB, como /api/octa/agente), designId, permissao e avisoPublicoAceito.
 * Projeto de outro dono = 404 (igual a inexistente). O dono vem da sessão, nunca do corpo.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import {
  lerProjeto, salvarArquivos, atualizarProjeto, apagarProjeto, lerArquivos,
  PERMISSOES, type Arquivos, type PatchProjeto, type PermissaoOcta, type ProjetosDb,
} from "@/lib/octa/projetos";

export const runtime = "nodejs";

const db = prisma as unknown as ProjetosDb;
type Ctx = { params: { id: string } };

async function donoDaSessao(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  return String((session!.user as any).id ?? email);
}

const naoEncontrado = () => NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await donoDaSessao();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projeto = await lerProjeto(db, userId, params.id);
  return projeto ? NextResponse.json({ projeto }) : naoEncontrado();
}

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await donoDaSessao();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));

  // valida tudo antes de escrever qualquer coisa
  const patch: PatchProjeto = {};
  if (body.permissao !== undefined) {
    if (!PERMISSOES.includes(body.permissao)) return NextResponse.json({ error: "permissao inválida" }, { status: 400 });
    patch.permissao = body.permissao as PermissaoOcta;
  }
  if (body.designId !== undefined) {
    if (body.designId !== null && typeof body.designId !== "string") return NextResponse.json({ error: "designId inválido" }, { status: 400 });
    patch.designId = body.designId;
  }
  if (body.avisoPublicoAceito !== undefined) {
    if (typeof body.avisoPublicoAceito !== "boolean") return NextResponse.json({ error: "avisoPublicoAceito inválido" }, { status: 400 });
    patch.avisoPublicoAceito = body.avisoPublicoAceito;
  }
  let arquivos: Arquivos | undefined;
  if (body.arquivos !== undefined) {
    const lidos = lerArquivos(body.arquivos);
    if (lidos === null) return NextResponse.json({ error: "arquivos inválidos" }, { status: 400 });
    if (lidos === "grande") return NextResponse.json({ error: "projeto grande demais (máx. 200 arquivos / 1,5 MB)" }, { status: 413 });
    arquivos = lidos;
  }

  if (!(await lerProjeto(db, userId, params.id))) return naoEncontrado();
  if (arquivos) await salvarArquivos(db, userId, params.id, arquivos);
  const projeto = await atualizarProjeto(db, userId, params.id, patch);
  return projeto ? NextResponse.json({ projeto }) : naoEncontrado();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await donoDaSessao();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return (await apagarProjeto(db, userId, params.id)) ? NextResponse.json({ ok: true }) : naoEncontrado();
}
