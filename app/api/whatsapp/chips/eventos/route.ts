/**
 * POST /api/whatsapp/chips/eventos — UM tick do ouvido dos chips (lib/whatsapp/eventos-chip): lê as mensagens que
 * chegaram nos chips da Zaeon e os estados de conexão no bridge Redis, responde e dá ACK. Interno (x-internal-token);
 * o server.js chama a cada WA_EVENTOS_A_CADA_S segundos (padrão 3).
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { internalAuthorized } from "@/lib/whatsapp/internal-auth";
import { tickEventos } from "@/lib/whatsapp/eventos-chip";

export async function POST(req: Request) {
  if (!internalAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await tickEventos()); }
  catch (e: any) { return NextResponse.json({ error: String(e?.message ?? e).slice(0, 200) }, { status: 500 }); }
}
