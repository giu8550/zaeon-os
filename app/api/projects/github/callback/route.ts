/**
 * GET /api/projects/github/callback — fim do OAuth user-to-server do GitHub.
 * Valida o `state`, troca o `code` pelo token do usuário, descobre o login,
 * cifra e grava no User, e volta pra sala Projetos — ou pro caminho do cookie `gh_oauth_voltar`
 * (gravado pelo connect, revalidado aqui contra a lista de lib/projects/github-voltar).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { exchangeCode, fetchLogin, storeUserToken } from "@/lib/projects/github-user";
import { COOKIE_VOLTAR, urlDeVolta } from "@/lib/projects/github-voltar";

export const runtime = "nodejs";

function back(reason: string) {
  let voltar: string | undefined;
  try { voltar = cookies().get(COOKIE_VOLTAR)?.value; } catch { /* sem cookies → padrão */ }
  const res = NextResponse.redirect(urlDeVolta(process.env.NEXTAUTH_URL || "http://localhost:3000", voltar, reason));
  if (voltar !== undefined) res.cookies.set(COOKIE_VOLTAR, "", { path: "/", maxAge: 0 });
  return res;
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
