/**
 * GET /api/octa/saude — o painel 🩺 "Monitorando alucinações e falhas de cognição" (Pack Octa §5).
 * Último relatório de cada agente. Só super admin; desligado sem NEXT_PUBLIC_OCTA_CODE.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { isSuperAdmin } from "@/lib/auth/roles";
import { OCTA_CODE_LIGADO } from "@/lib/octa/flag";
import { PrismaEvalStore } from "@/lib/octa/evals/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!OCTA_CODE_LIGADO) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin({ email: session?.user?.email, role: (session?.user as any)?.role })) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ relatorios: await new PrismaEvalStore().ultimos() });
  } catch (e: any) {
    return NextResponse.json({ error: "store_indisponivel", detalhe: String(e?.message ?? e) }, { status: 503 });
  }
}
