/**
 * POST /api/lounge3d/[id]/acesso { alvo: "topo" | "ceu" | "nave" | "dj" } — AÇÕES PRIVILEGIADAS do dono no cyberespaço:
 * subir ao topo da Recepção, pilotar a nave e atravessar o PAR de buracos negros nave ↔ cabine do DJ (a única entrada
 * da cabine). Só o fundador (isSuperAdmin pela SESSÃO, nunca por flag do cliente) recebe
 * 200; o resto 403. O cliente só age depois do OK. A ZAEON (portal do buraco negro → "ceu") é ABERTA a qualquer membro.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";

const ALVOS = new Set(["topo", "ceu", "nave", "dj"]);
const NEGADO: Record<string, string> = {
  topo: "Só o dono da Zaeon sobe ao topo.",
  nave: "Só o dono pilota a nave.",
  dj: "Só o dono atravessa este buraco negro.",
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-acesso"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const alvo = String((b as { alvo?: unknown })?.alvo ?? "");
  if (!ALVOS.has(alvo)) return NextResponse.json({ error: "alvo inválido" }, { status: 400 });
  if (!me.fundador && alvo !== "ceu") return NextResponse.json({ error: NEGADO[alvo] }, { status: 403 });
  return NextResponse.json({ ok: true, alvo });
}
