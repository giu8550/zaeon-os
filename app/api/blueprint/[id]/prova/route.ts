/**
 * POST /api/blueprint/:id/prova { criticoId, url } → { ok, motivo?, blueprint?, avaliacao? } — a PROVA de um crítico
 * vermelho: o servidor confere o artefato (lib/blueprint/provas-server) e, quando a fase inteira está provada, a Zaeon
 * avalia pela rubrica; aprovada, a fase avança. Só dono/editor. Prova recusada = 200 com `ok: false` e o motivo (é
 * resposta pra pessoa, não erro do sistema).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
import { NextResponse } from "next/server";
import { podeEscrever } from "@/lib/cartolina/access";
import { provarEAvaliar } from "@/lib/blueprint/provas-server";
import { blueprintDoUsuario } from "@/lib/blueprint/server";
import { blueprintOn, idOk } from "@/lib/blueprint/tipos";
import { entrarNoBoard, falhaBoard } from "@/lib/estudos/rota";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!blueprintOn()) return falhaBoard("not_found");
  const a = await entrarNoBoard(req, "blueprint-prova", "ai-heavy"); if ("response" in a) return a.response;
  const b = (await req.json().catch(() => null)) as { criticoId?: unknown; url?: unknown } | null;
  if (!b || !idOk(b.criticoId) || typeof b.url !== "string" || b.url.length > 500) return falhaBoard("invalid");
  const atual = await blueprintDoUsuario(params.id, a.userId);
  if (!atual) return falhaBoard("not_found");
  if (!podeEscrever(atual.papel)) return falhaBoard("forbidden");
  const r = await provarEAvaliar({ id: params.id, userId: a.userId, criticoId: b.criticoId, url: b.url });
  if (r.motivo === "not_found" || r.motivo === "forbidden" || r.motivo === "conflict") return falhaBoard(r.motivo);
  return NextResponse.json({ ok: r.ok, motivo: r.motivo, blueprint: r.view ?? null, avaliacao: r.avaliacao ?? null });
}
