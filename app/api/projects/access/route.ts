/**
 * GET /api/projects/access
 *
 * Capacidade do usuário atual para o Zaeon Code (sala Projetos). A Plugin Store
 * usa isto para decidir o que acontece ao "Ativar": super admin ou curso de
 * Computação → entra; senão mostra o aviso de elegibilidade.
 *
 * Sempre responde 200 (mesmo deslogado) para simplificar o consumo no cliente.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { checkEligibility } from "@/lib/projects/access";
import { isSuperAdmin } from "@/lib/auth/roles";
import { effectivePlan, type PlanState } from "@/lib/plans";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;
  if (!email) {
    return NextResponse.json({ authenticated: false, canUse: false, superAdmin: false, reason: "unauthenticated", course: null });
  }
  let course: string | null = null;
  let role: string | null = null;
  let plan: string | null = null;
  let projectsEnabled = false;
  try {
    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { course: true, role: true, plan: true, plusUntil: true, trialGranted: true, projectsEnabled: true },
    });
    course = dbUser?.course ?? null;
    role = dbUser?.role ?? null;
    const state: PlanState = { plan: dbUser?.plan || "free", plusUntil: dbUser?.plusUntil ?? null, trialGranted: !!dbUser?.trialGranted };
    plan = effectivePlan(state);
    projectsEnabled = !!dbUser?.projectsEnabled;
  } catch { /* DB indisponível → trata como sem curso */ }
  const ctx = { email, role, plan, projectsEnabled };
  const res = checkEligibility(course, ctx);
  return NextResponse.json({
    authenticated: true,
    superAdmin: isSuperAdmin(ctx),
    canUse: res.eligible,
    reason: res.reason, // exact | keyword | super-admin | plan | admin-release | no-course | out-of-scope | gate-disabled
    course,
    plan,
  });
}
