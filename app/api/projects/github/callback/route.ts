/**
 * GET /api/projects/github/callback — fim do OAuth user-to-server do GitHub.
 * Valida o `state`, troca o `code` pelo token do usuário, descobre o login,
 * cifra e grava no User, e volta pra sala Projetos.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { exchangeCode, fetchLogin, storeUserToken } from "@/lib/projects/github-user";

export const runtime = "nodejs";

function back(reason: string) {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return NextResponse.redirect(new URL(`/research-lab?tab=projetos&gh=${reason}`, base));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = cookies().get("gh_oauth_state")?.value;
    if (!code || !state || !cookieState || state !== cookieState) return back("state");

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return back("auth");

    const tok = await exchangeCode(code);
    const login = await fetchLogin(tok.access_token);
    await storeUserToken(session.user.email, tok, login);

    const res = back("connected");
    res.cookies.set("gh_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch (err: any) {
    return back("error");
  }
}
