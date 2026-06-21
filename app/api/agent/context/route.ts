/**
 * /api/agent/context — world-state durável do aluno (ver docs/AGENT_CONTEXT_AND_EXECUTION.md).
 *
 *   GET → retorna o contexto atual do usuário (ou um vazio).
 *   PUT → faz merge (upsert) do contexto enviado pelo cliente.
 *
 * Chave por email da sessão. Sem sessão → 401.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import connectToDatabase from "@/src/lib/db";
import AgentContext from "@/src/models/AgentContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Campos que o cliente pode gravar (allowlist — evita lixo/abuso no doc).
const WRITABLE = [
  "activeRoom",
  "activeTab",
  "currentStudyId",
  "currentResearchId",
  "currentProjectId",
  "currentGoal",
] as const;

function shape(doc: any) {
  if (!doc) return {};
  return {
    activeRoom: doc.activeRoom ?? null,
    activeTab: doc.activeTab ?? null,
    currentStudyId: doc.currentStudyId ?? null,
    currentResearchId: doc.currentResearchId ?? null,
    currentProjectId: doc.currentProjectId ?? null,
    currentGoal: doc.currentGoal ?? null,
    recentActions: Array.isArray(doc.recentActions) ? doc.recentActions.slice(-15) : [],
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).getTime() : null,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await connectToDatabase();
    const doc = await AgentContext.findOne({ email }).lean();
    return NextResponse.json(shape(doc));
  } catch {
    return NextResponse.json({}); // DB fora → contexto vazio (não quebra a UI)
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({} as any));
    const set: Record<string, unknown> = {};
    for (const k of WRITABLE) {
      if (body[k] !== undefined) set[k] = body[k] === null ? null : String(body[k]).slice(0, 400);
    }

    const ops: Record<string, unknown> = {};
    if (Object.keys(set).length) ops.$set = set;

    // Anexa uma ação recente (opcional) e mantém só as últimas 15.
    if (body.action && typeof body.action.kind === "string") {
      ops.$push = {
        recentActions: {
          $each: [{ kind: body.action.kind.slice(0, 40), detail: String(body.action.detail ?? "").slice(0, 200), at: Date.now() }],
          $slice: -15,
        },
      };
    }

    await connectToDatabase();
    const doc = await AgentContext.findOneAndUpdate(
      { email },
      Object.keys(ops).length ? ops : { $set: { email } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    return NextResponse.json(shape(doc));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Falha ao salvar contexto." }, { status: 500 });
  }
}
