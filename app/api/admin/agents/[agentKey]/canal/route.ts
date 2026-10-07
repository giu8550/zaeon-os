/**
 * /api/admin/agents/[agentKey]/canal (founder-only, flag NEXT_PUBLIC_AGENTS_ADMIN) — o campo
 * "conectar chip" do PR-W1, sem UI: vincula um AgentChannel ao chip da ChipFlow pelo id.
 *   GET            → { canais } do agente (token mascarado).
 *   PUT  { tipo?="whatsapp", chipflowId, chipflowToken?, numero?, limiteDia?, ownerEmail?, pool?,
 *          tierReportado?, mensagensReportadas?, apiVersion? } → upsert, estado "vinculado".
 *   DELETE ?tipo=  → desvincula (estado nao_vinculado, mantém o documento).
 * O botão [conectar chip] com a lista do diretório é o PR-W2/W5.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { agentsAdmin } from "@/lib/canal/flags";
import { rosterComMentores, isAgentKey } from "@/lib/agents/roster";
import { toE164 } from "@/lib/whatsapp/phone";

type Ctx = { params: { agentKey: string } };
const TIPOS = new Set(["whatsapp", "email"]);

async function gate(): Promise<NextResponse | null> {
  if (!agentsAdmin()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: a.status === 401 ? "Unauthorized" : "Forbidden" }, { status: a.status });
  return null;
}

/** Inteiro positivo (número ou string só de dígitos). Qualquer outra coisa → null. */
export function parseChipflowId(v: unknown): number | null {
  if (typeof v === "number") return Number.isSafeInteger(v) && v > 0 ? v : null;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) { const n = Number(v.trim()); return n > 0 && Number.isSafeInteger(n) ? n : null; }
  return null;
}

const mascarar = <T extends { chipflowToken?: string | null }>(c: T): T => ({
  ...c, chipflowToken: c.chipflowToken ? `••••${c.chipflowToken.slice(-4)}` : null,
});

async function agenteExiste(agentKey: string): Promise<boolean> {
  if (await prisma.agentProfile.findUnique({ where: { agentKey } })) return true;
  const mentores = await prisma.mentorTemplate.findMany({ select: { slug: true, name: true, course: true, emoji: true, personaText: true, order: true } });
  return rosterComMentores(mentores).some((a) => a.agentKey === agentKey);
}

export async function GET(_req: Request, { params }: Ctx) {
  const g = await gate(); if (g) return g;
  const agentKey = String(params.agentKey || "").toLowerCase();
  if (!isAgentKey(agentKey)) return NextResponse.json({ error: "agentKey inválido" }, { status: 400 });
  const canais = await prisma.agentChannel.findMany({ where: { agentKey }, orderBy: { tipo: "asc" } });
  return NextResponse.json({ canais: canais.map(mascarar) });
}

export async function PUT(req: Request, { params }: Ctx) {
  const g = await gate(); if (g) return g;
  const agentKey = String(params.agentKey || "").toLowerCase();
  if (!isAgentKey(agentKey)) return NextResponse.json({ error: "agentKey inválido" }, { status: 400 });
  if (!(await agenteExiste(agentKey))) return NextResponse.json({ error: "Agente desconhecido — crie com POST /api/admin/agents." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const tipo = typeof b?.tipo === "string" && TIPOS.has(b.tipo) ? b.tipo : "whatsapp";
  const chipflowId = parseChipflowId(b?.chipflowId);
  if (!chipflowId) return NextResponse.json({ error: "chipflowId tem de ser inteiro positivo (o id do chip na ChipFlow)." }, { status: 400 });
  let numero: string | null = null;
  if (b?.numero !== undefined && b?.numero !== null && b?.numero !== "") {
    numero = toE164(String(b.numero));
    if (!numero) return NextResponse.json({ error: "numero inválido (use E.164, ex.: +5511999999999)." }, { status: 400 });
  }
  const str = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const token = str(b?.chipflowToken, 200);
  const now = new Date();
  const campos = {
    chipflowId,
    numero,
    ownerEmail: str(b?.ownerEmail),
    pool: str(b?.pool, 20),
    tierReportado: str(b?.tierReportado, 20),
    mensagensReportadas: Number.isFinite(b?.mensagensReportadas) ? Math.trunc(Number(b.mensagensReportadas)) : null,
    apiVersion: str(b?.apiVersion, 20),
    limiteDia: Number.isFinite(b?.limiteDia) && Number(b.limiteDia) > 0 ? Math.trunc(Number(b.limiteDia)) : undefined,
    estado: "vinculado",
    origem: "chipflow",
    sincronizadoEm: now,
    ...(token ? { chipflowToken: token, tokenAtualizadoEm: now } : {}),
  };
  const canal = await prisma.agentChannel.upsert({
    where: { agentKey_tipo: { agentKey, tipo } },
    update: campos,
    create: { agentKey, tipo, ...campos, limiteDia: campos.limiteDia ?? 20 },
  });
  return NextResponse.json({ canal: mascarar(canal) });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const g = await gate(); if (g) return g;
  const agentKey = String(params.agentKey || "").toLowerCase();
  if (!isAgentKey(agentKey)) return NextResponse.json({ error: "agentKey inválido" }, { status: 400 });
  const tipo = new URL(req.url).searchParams.get("tipo") || "whatsapp";
  if (!TIPOS.has(tipo)) return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  await prisma.agentChannel.updateMany({
    where: { agentKey, tipo },
    data: { estado: "nao_vinculado", chipflowId: null, chipflowToken: null, tokenAtualizadoEm: null },
  });
  return NextResponse.json({ ok: true });
}
