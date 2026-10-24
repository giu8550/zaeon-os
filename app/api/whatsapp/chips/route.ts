/**
 * GET  /api/whatsapp/chips — os chips de WhatsApp da Zaeon (CEO).
 * POST /api/whatsapp/chips {nome, papel: zaeon|agente|pessoal, agentKey?} — cria o chip e a sessão no adapter
 *      (o QR sai em GET /api/whatsapp/chips/[id]/conectar). Ver docs/WHATSAPP_CHIPS.md.
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { chipPublico, criarChip, listarChips, PAPEIS, type Papel } from "@/lib/whatsapp/chips";
import { operadorConfigurado } from "@/lib/chipflow/operador";

export async function GET() {
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: "Proibido" }, { status: a.status });
  const chips = await listarChips();
  return NextResponse.json({ chips: chips.map(chipPublico), adapter: operadorConfigurado() });
}

export async function POST(req: Request) {
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: "Proibido" }, { status: a.status });
  if (!operadorConfigurado()) return NextResponse.json({ error: "adapter de WhatsApp não configurado na VPS (WA_OPERATOR_URL/WA_OPERATOR_TOKEN)" }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const papel = (PAPEIS.includes(b?.papel) ? b.papel : "zaeon") as Papel;
  if (papel === "agente" && !String(b?.agentKey ?? "").trim()) return NextResponse.json({ error: "chip de agente precisa do agentKey" }, { status: 400 });
  const { prisma } = await import("@/src/lib/prisma");
  const eu = await prisma.user.findUnique({ where: { email: a.email }, select: { id: true } }).catch(() => null);
  const chip = await criarChip({ nome: String(b?.nome ?? "").trim() || "Chip da Zaeon", papel, agentKey: b?.agentKey ?? null, criadoPor: eu?.id ?? null });
  return NextResponse.json({ chip: chipPublico(chip) }, { status: 201 });
}
