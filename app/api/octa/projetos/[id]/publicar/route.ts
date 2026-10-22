/**
 * POST /api/octa/projetos/[id]/publicar — o botão "Publicar" da IDE: publica o projeto no GitHub DO ALUNO
 * (lib/octa/publicar). Corpo opcional: `{ mensagem }` (texto do commit). Dono e email vêm da SESSÃO.
 *
 * 200 `{ ok:true, repoUrl, pagesUrl, status, ignorados }` · 404 projeto de outro dono/inexistente ·
 * 409/429/502 `{ ok:false, erro }` (+ `palavra` em marca_no_conteudo) com o código fixo de publicarProjeto (a IDE traduz). Nunca devolve token
 * nem mensagem crua do GitHub — publicarProjeto já fecha isso.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { publicarProjeto, type ErroPublicar } from "@/lib/octa/publicar";
import { getUserOctokit } from "@/lib/projects/github-user";
import type { ProjetosDb } from "@/lib/octa/projetos";

export const runtime = "nodejs";
export const maxDuration = 120; // criar repo + commit + ligar o Pages

type Ctx = { params: { id: string } };

const STATUS: Record<Exclude<ErroPublicar, "projeto_inexistente">, number> = {
  aviso_publico_pendente: 409,
  github_reconectar: 409,
  github_sem_permissao: 409,
  sem_arquivos_publicaveis: 409,
  limite_publicacoes: 429,
  limite_repos: 429,
  falha_github: 502,
  marca_no_conteudo: 409,
  tipo_nao_publicavel: 409,
};

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = String((session!.user as any).id ?? email);
  const rl = await guard(req, "octa-publicar", "ai-heavy");
  if (!rl.ok) return rl.response;

  const body = await req.json().catch(() => ({} as any));
  const mensagem = typeof body?.mensagem === "string" ? body.mensagem.slice(0, 200) : undefined;

  const r = await publicarProjeto(
    { db: prisma as unknown as ProjetosDb, octokitDoAluno: (e) => getUserOctokit(e) },
    { userId, email, projetoId: params.id, ...(mensagem ? { mensagem } : {}) },
  );
  if (r.ok) return NextResponse.json(r);
  if (r.erro === "projeto_inexistente") return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  // marca_no_conteudo leva só a palavra (a IDE diz ao aluno o que editar)
  const extra = r.erro === "marca_no_conteudo" ? { palavra: r.palavra } : {};
  return NextResponse.json({ ok: false, erro: r.erro, ...extra }, { status: STATUS[r.erro] ?? 502 });
}
