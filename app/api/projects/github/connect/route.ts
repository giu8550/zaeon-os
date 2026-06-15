/**
 * GET /api/projects/github/connect — inicia o OAuth user-to-server do GitHub.
 * Gera um `state` (anti-CSRF) em cookie httpOnly e redireciona pro authorize.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { buildAuthorizeUrl, isUserOAuthConfigured } from "@/lib/projects/github-user";

export const runtime = "nodejs";

function back(reason: string) {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return NextResponse.redirect(new URL(`/research-lab?tab=projetos&gh=${reason}`, base));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return back("auth");
  if (!isUserOAuthConfigured()) return back("unconfigured");

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set("gh_oauth_state", state, {
    httpOnly: true,
    secure: (process.env.NEXTAUTH_URL || "").startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
