/**
 * GitHub App post-install callback.
 *
 * GitHub redireciona aqui após o usuário instalar (ou atualizar) o App
 * "Zaeon Code" nos repositórios dele. A URL desta rota deve ser configurada
 * como "Setup URL" nas settings do GitHub App:
 *
 *   https://github.com/settings/apps/{slug}/edit  →  "Setup URL"
 *   → aponta para: https://zaeon.space/api/projects/github/setup
 *
 * Query params recebidos do GitHub:
 *   installation_id  — id numérico da instalação
 *   setup_action     — "install" | "update"
 *
 * O que fazemos aqui:
 *   1. Lê a sessão NextAuth (cookie já está no browser do usuário).
 *   2. Salva installation_id em User.githubInstallationId (Prisma).
 *   3. Redireciona para a sala de Projetos com ?github_installed=true.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action") ?? "install"; // "install" | "update"

  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://zaeon.space";

  const successUrl = `${base}/research-lab/projects?github_installed=true&action=${setupAction}`;
  const errorUrl   = `${base}/research-lab/projects?github_error=missing_installation_id`;

  // GitHub não enviou installation_id → algo errado.
  if (!installationId) {
    return NextResponse.redirect(errorUrl);
  }

  // Tenta salvar no usuário autenticado.
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    try {
      await prisma.user.update({
        where: { email: session.user.email },
        data:  { githubInstallationId: installationId },
      });
    } catch (err) {
      // Campo githubInstallationId pode ainda não existir na migration de prod.
      // Não bloqueia o redirect — o env GITHUB_APP_INSTALLATION_ID é o fallback.
      console.error("[github/setup] failed to persist installation_id:", err);
    }
  }

  return NextResponse.redirect(successUrl);
}
