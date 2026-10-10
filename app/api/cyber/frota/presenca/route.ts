/**
 * GET /api/cyber/frota/presenca — (modo admin) quantos USUÁRIOS REAIS estão no cyberespaço agora: a soma dos canais de
 * presença das salas (`presence-lounge3d-<id>`, lib/lounge3d/tipos) no Pusher. Só o dono. Sem Pusher configurado,
 * `usuarios: null` (o painel mostra "—").
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getPusher } from "@/lib/collab/realtime";

export async function GET() {
  const { assertAdmin } = await import("@/lib/admin/assertAdmin");
  const a = await assertAdmin(); if (!a.ok) return NextResponse.json({ error: "forbidden" }, { status: a.status });
  const p = getPusher();
  if (!p) return NextResponse.json({ usuarios: null, salas: 0 }, { headers: { "Cache-Control": "no-store" } });
  try {
    const r = await p.get({ path: "/channels", params: { filter_by_prefix: "presence-lounge3d-", info: "user_count" } });
    const j = (await r.json()) as { channels?: Record<string, { user_count?: number }> };
    const canais = Object.values(j.channels ?? {});
    return NextResponse.json({ usuarios: canais.reduce((n, c) => n + (c.user_count ?? 0), 0), salas: canais.length }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ usuarios: null, salas: 0 }, { headers: { "Cache-Control": "no-store" } });
  }
}
