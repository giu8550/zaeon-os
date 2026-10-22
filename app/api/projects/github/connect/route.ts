/**
 * GET /api/projects/github/connect — inicia o OAuth user-to-server do GitHub.
 * Gera um `state` (anti-CSRF) em cookie httpOnly e redireciona pro authorize.
 * `?voltar=` (opcional, só caminhos da lista em lib/projects/github-voltar) diz pra onde o callback volta;
 * fica num cookie httpOnly. Sem ele, volta pra sala Projetos como sempre.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { buildAuthorizeUrl, isUserOAuthConfigured } from "@/lib/projects/github-user";
import { COOKIE_VOLTAR, urlDeVolta, voltarPermitido } from "@/lib/projects/github-voltar";

export const runtime = "nodejs";

function back(reason: string, voltar: string | null) {
  return NextResponse.redirect(urlDeVolta(process.env.NEXTAUTH_URL || "http://localhost:3000", voltar, reason));
}

export async function GET(req: Request) {
  const voltar = voltarPermitido(new URL(req.url).searchParams.get("voltar"));
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return back("auth", voltar);
  if (!isUserOAuthConfigured()) return back("unconfigured", voltar);

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  const cookie = {
    httpOnly: true,
    secure: (process.env.NEXTAUTH_URL || "").startsWith("https"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  res.cookies.set("gh_oauth_state", state, cookie);
  if (voltar) res.cookies.set(COOKIE_VOLTAR, voltar, cookie);
  else res.cookies.set(COOKIE_VOLTAR, "", { path: "/", maxAge: 0 }); // volta de um fluxo antigo não vaza pra este
  return res;
}
