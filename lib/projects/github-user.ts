/**
 * GitHub OAuth user-to-server (modelo "conta pessoal do aluno").
 *
 * O aluno autoriza o App "Zaeon Code"; guardamos o access token DELE (cifrado) e
 * passamos a agir como ele — criar repos na conta dele (POST /user/repos),
 * commitar, abrir PR, etc. É o complemento do installation token (que não cria
 * repo em conta pessoal).
 *
 * Env: GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, GITHUB_APP_CALLBACK_URL
 * (ou deriva de NEXTAUTH_URL). octokit é importado dinamicamente (build-green).
 */
import { prisma } from "@/src/lib/prisma";
import { encryptToken, decryptToken } from "./crypto";

type AnyOctokit = any;

export function isUserOAuthConfigured(): boolean {
  return !!process.env.GITHUB_APP_CLIENT_ID && !!process.env.GITHUB_APP_CLIENT_SECRET;
}

function callbackUrl(): string {
  return process.env.GITHUB_APP_CALLBACK_URL
    || `${process.env.NEXTAUTH_URL || ""}/api/projects/github/callback`;
}

/** URL de autorização (user-to-server). `state` liga a sessão (anti-CSRF). */
export function buildAuthorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GITHUB_APP_CLIENT_ID || "",
    redirect_uri: callbackUrl(),
    state,
  });
  return `https://github.com/login/oauth/authorize?${p.toString()}`;
}

/** Troca o `code` por tokens do usuário. */
export async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_APP_CLIENT_ID,
      client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl(),
    }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!data?.access_token) throw new Error(data?.error_description || data?.error || "Falha ao obter token do GitHub.");
  return data;
}

/** Lê o login do GitHub do dono do token. */
export async function fetchLogin(token: string): Promise<string | null> {
  const r = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!r.ok) return null;
  const d = await r.json().catch(() => ({} as any));
  return d?.login ?? null;
}

export async function storeUserToken(email: string, tok: { access_token: string; refresh_token?: string; expires_in?: number }, login: string | null): Promise<void> {
  const data: any = {
    githubUserToken: encryptToken(tok.access_token),
    githubUserLogin: login,
    githubRefreshToken: tok.refresh_token ? encryptToken(tok.refresh_token) : null,
    githubTokenExpiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
  };
  await prisma.user.update({ where: { email }, data });
}

export async function clearUserToken(email: string): Promise<void> {
  await prisma.user.update({
    where: { email },
    data: { githubUserToken: null, githubUserLogin: null, githubRefreshToken: null, githubTokenExpiresAt: null } as any,
  });
}

export async function getUserConnection(email: string): Promise<{ connected: boolean; login: string | null }> {
  const u: any = await prisma.user.findUnique({ where: { email }, select: { githubUserToken: true, githubUserLogin: true } as any });
  return { connected: !!u?.githubUserToken, login: u?.githubUserLogin ?? null };
}

// Renova quando o token já venceu ou faltam menos de 5 min (a publicação inteira cabe nessa margem).
const MARGEM_RENOVACAO_MS = 5 * 60_000;

/**
 * Troca o refresh token por um access token novo e regrava os dois cifrados.
 * Qualquer falha (sem refresh, resposta sem token, rede, chave ausente) → null; o motivo
 * não é logado nem propagado — a resposta do GitHub pode ecoar o token.
 */
async function renovarToken(email: string, refreshCifrado: string | null | undefined): Promise<string | null> {
  if (!refreshCifrado || !isUserOAuthConfigured()) return null;
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_APP_CLIENT_ID,
        client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: decryptToken(refreshCifrado),
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (typeof data?.access_token !== "string" || !data.access_token) return null;
    await prisma.user.update({
      where: { email },
      data: {
        githubUserToken: encryptToken(data.access_token),
        // o GitHub gira o refresh token a cada uso; sem um novo, o antigo já não vale
        githubRefreshToken: data.refresh_token ? encryptToken(data.refresh_token) : null,
        githubTokenExpiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      } as any,
    });
    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Octokit autenticado COMO O USUÁRIO (token dele). null se não conectado ou se o token
 * venceu e a renovação falhou (→ o aluno reconecta).
 */
export async function getUserOctokit(email: string): Promise<AnyOctokit | null> {
  const u: any = await prisma.user.findUnique({
    where: { email },
    select: { githubUserToken: true, githubRefreshToken: true, githubTokenExpiresAt: true } as any,
  });
  if (!u?.githubUserToken) return null;
  let token: string | null;
  const expira = u.githubTokenExpiresAt ? new Date(u.githubTokenExpiresAt).getTime() : null;
  if (expira !== null && expira - Date.now() < MARGEM_RENOVACAO_MS) {
    token = await renovarToken(email, u.githubRefreshToken);
  } else {
    try { token = decryptToken(u.githubUserToken); } catch { token = null; }
  }
  if (!token) return null;
  let mod: any;
  try { mod = await import("octokit"); } catch { return null; }
  return new mod.Octokit({ auth: token });
}
