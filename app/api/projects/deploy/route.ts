/**
 * POST /api/projects/deploy — publica o projeto direto na Vercel (sem VPS).
 *
 * Usa a Vercel REST API (POST /v13/deployments) com os arquivos INLINE, então um
 * app web (HTML/CSS/JS, ou framework que a Vercel saiba buildar) sobe na hora e
 * retorna uma URL pública. É o caminho "só Vercel" pra o usuário ver o projeto no ar.
 *
 * STATUS honesto: precisa de um VERCEL_TOKEN no ambiente (e, opcional,
 * VERCEL_TEAM_ID). Sem isso, devolve 503 com instrução — igual ao padrão do
 * GitHub App / Anthropic. Nada de mock: quando o token existe, é deploy real.
 *
 * Ref: https://vercel.com/docs/rest-api/deployments/create-a-new-deployment
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { assertEligibleOrThrow, ProjectsAccessError } from "@/lib/projects/access";
import { effectivePlan, type PlanState } from "@/lib/plans";

export const runtime = "nodejs";
// VPS: sem o teto de 10s do Vercel.
export const maxDuration = 120;

/** Vercel project names: lowercase, [a-z0-9._-], <=100 chars. */
function sanitizeName(raw: string): string {
  const base = (raw || "zaeon-projeto")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return base || "zaeon-projeto";
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const dbUser = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, course: true, role: true, plan: true, plusUntil: true, trialGranted: true, projectsEnabled: true } });
    if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    {
      const state: PlanState = { plan: dbUser.plan || "free", plusUntil: dbUser.plusUntil ?? null, trialGranted: !!dbUser.trialGranted };
      assertEligibleOrThrow(dbUser.course, { email: session.user.email, role: dbUser.role, plan: effectivePlan(state), projectsEnabled: !!dbUser.projectsEnabled });
    }

    const token = process.env.VERCEL_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Deploy na Vercel não configurado. Defina VERCEL_TOKEN (e opcional VERCEL_TEAM_ID) no ambiente." },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const name = sanitizeName(typeof body.name === "string" ? body.name : "zaeon-projeto");
    const rawFiles: { path?: string; content?: string }[] = Array.isArray(body.files) ? body.files : [];
    const files = rawFiles
      .filter((f) => f && typeof f.path === "string" && typeof f.content === "string")
      .map((f) => ({ file: f.path!.replace(/^\/+/, ""), data: f.content!, encoding: "utf-8" as const }));
    if (!files.length) return NextResponse.json({ error: "Nenhum arquivo para publicar." }, { status: 400 });

    const teamId = process.env.VERCEL_TEAM_ID;
    const url = `https://api.vercel.com/v13/deployments${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        files,
        target: "production",
        projectSettings: { framework: null }, // estático/auto-detect; Vercel buildará se houver framework
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `Falha no deploy (${res.status}).`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const deployUrl = data?.url ? `https://${data.url}` : null;
    const aliasUrl = Array.isArray(data?.alias) && data.alias[0] ? `https://${data.alias[0]}` : null;
    return NextResponse.json({
      ok: true,
      url: aliasUrl || deployUrl,
      deploymentUrl: deployUrl,
      inspectorUrl: data?.inspectorUrl ?? null,
      readyState: data?.readyState ?? null,
      note: "Deploy criado na Vercel. O build roda em segundos; a URL pode levar um instante para ficar pronta.",
    });
  } catch (err: any) {
    if (err instanceof ProjectsAccessError) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: 403 });
    }
    return NextResponse.json({ error: err?.message ?? "Falha no deploy." }, { status: 500 });
  }
}
