/**
 * POST /api/lounge3d/[id]/acesso { alvo: "topo" | "ceu" | "nave" } — AÇÕES PRIVILEGIADAS do dono no cyberespaço:
 * subir ao topo do QG, atravessar o portal (buraco negro) até a Zaeon (a ilha no céu) e pilotar a nave. Só o fundador
 * (isSuperAdmin pela SESSÃO, nunca por flag do cliente) recebe 200; o resto 403. O cliente só age depois do OK.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";

const ALVOS = new Set(["topo", "ceu", "nave"]);
const NEGADO: Record<string, string> = {
  topo: "Só o dono da Zaeon sobe ao topo.",
  ceu: "A Zaeon é a base do dono — o portal não abre pra você.",
  nave: "Só o dono pilota a nave.",
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-acesso"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const alvo = String((b as { alvo?: unknown })?.alvo ?? "");
  if (!ALVOS.has(alvo)) return NextResponse.json({ error: "alvo inválido" }, { status: 400 });
  if (!me.fundador) return NextResponse.json({ error: NEGADO[alvo] }, { status: 403 });
  return NextResponse.json({ ok: true, alvo });
}
